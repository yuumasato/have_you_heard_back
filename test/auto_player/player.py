import json
import socketio
import threading
import time

from auto_player import common

PT_PERSONAS = [
        'Antivacina',
        'Bonosaro',
        'Eron Must',
        'Lulo',
        'Salvio',
        'Tia do Zap',
        'Tump',
        'Vegana'
        ]

class Player():
    def __init__(self, server, game_name, player_data=None, verbose=False):
        self.server = server
        self.game_name = game_name
        self.verbose = verbose

        self.room_id = 0
        self.prescripted = False
        self.round_winners = []
        self.game_winner = 'not_set'

        if player_data:
            self.prescripted = True
            self.name = player_data['name']
            self.persona = player_data['persona']
            self.round_data = player_data['rounds']
        else:
            self.name = 'player_' + common.random_string(6, 6)
            self.persona = PT_PERSONAS[common.random_int(0, 7)]
            self.round_data = []

        self.sio = socketio.Client()

        self.event = threading.Event()

        self.setup_callbacks()
        self.sio.connect(self.server, transports=['websocket'])


    def setup_callbacks(self):
        @self.sio.event
        def connect():
            self.print_log('connection established')
            self.event.set()

        @self.sio.event
        def disconnect():
            self.print_log('connection closed')

        @self.sio.on('user id')
        def user_id(data):
            self.print_log('user ID - ' + data)
            self.id = data

            self.emit_name()
            self.emit_lang()

            self.event.set()

        @self.sio.event
        def room(data):
            room = json.loads(data)
            self.print_log('received room')
            self.room_id = room['id'][5:]
            self.event.set()

        @self.sio.event
        def game(data):
            self.game = json.loads(data)
            self.print_log('Game received')
            self.event.set()

        @self.sio.event
        def persona(data):
            self.print_log('Received persona - ' + data)

        @self.sio.on('round answers')
        def round_answers(data):
            self.print_log('Round answers')
            self.event.set()

        @self.sio.on('round winner')
        def round_winners(data):
            winner_name = self.get_player_name(data)
            self.print_log('Round winner')
            self.round_winners.append(winner_name)
            self.event.set()

        @self.sio.on('game winner')
        def game_winner(data):
            winner_data = json.loads(data)
            winner_name = self.get_player_name(winner_data['winner'])

            self.print_log('Game winner - ' + winner_name)
            self.game_winner = winner_name
            self.event.set()

    def print_log(self, msg):
        if self.verbose:
            print("["+self.game_name+"] " + self.name + ': ' + msg)

    def get_player_name(self, player_id):
        for p in self.game['players']:
            if p['id'] == player_id:
                return p['name']
        return None

    def emit_user(self):
        self.sio.emit('user')

    def emit_lang(self):
        self.sio.emit('language', 'pt')

    def emit_name(self):
        self.sio.emit('name', self.name)

    def emit_new_room(self):
        self.print_log('emiting new room')
        self.sio.emit('new room')

    def emit_join(self, room_id):
        self.print_log('emiting join ' + room_id)
        self.sio.emit('join', room_id)

    def emit_leave(self):
        self.sio.emit('leave')

    def emit_start(self):
        self.print_log('emiting start')
        self.sio.emit('start')

    def emit_vote_persona(self):
        self.print_log('Vote persona: ' + self.persona)
        self.sio.emit('vote persona', self.persona)

    def emit_answer(self, i):
        if self.prescripted:
            delay = self.round_data[i].get('answer_delay', 0)
            answer = self.round_data[i]['answer']
        else:
            delay = common.random_int(0, 20)
            answer = common.random_string(0, 26)

            data = {}
            data['answer'] = answer
            data['answer_delay'] = delay
            self.round_data.append(data)

        self.print_log('Sending answer: "{}" with {}s delay'.format(answer, str(delay)))
        time.sleep(delay)
        self.sio.emit('answer', answer)

    def emit_vote_answer(self, i):
        vote_id = None
        if self.prescripted:
            player_to_vote = self.round_data[i]['vote']
            for p in self.game['players']:
                if p['name'] == player_to_vote:
                    vote_id = p['id']
            if not vote_id:
                raise Exception('{} could not find player to vote: {}'.format(self.name, player_to_vote))
        else:
            other_players = []
            for p in self.game['players']:
                if p['name'] != self.name: 
                    other_players.append(p)

            p_index = common.random_int(0, len(other_players)-1)
            player_to_vote = other_players[p_index]['name']
            vote_id = self.game['players'][p_index]['id']

            self.round_data[i]['vote'] = player_to_vote

        self.print_log('Emiting vote answer: ' + player_to_vote + '['+vote_id+']')
        self.sio.emit('vote answer', vote_id)

    def emit_rematch(self):
        self.sio.emit('rematch')

    def disconnect(self):
        self.event.clear()
        self.sio.disconnect()

    def setup_user(self):
        self.emit_user()
