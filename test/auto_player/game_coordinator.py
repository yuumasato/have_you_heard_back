import time
import threading
import yaml

from auto_player import common
from auto_player import player

class GameCoordinator():

    def __init__(self, server_url, test_data=None, verbose=False):
        self.players = []
        self.n_rounds = 3
        self.expected_game_winner = None
        self.expected_round_winners = []

        self.server_url = server_url
        if test_data:
            self.game_name = test_data['name']
            for player_data in test_data['players']:
                x = player.Player(self.server_url, self.game_name, player_data, verbose)
                self.players.append(x)

            if 'result' in test_data:
                self.expected_game_winner = test_data['result']['game_winner']
                for game_round in test_data['result']['rounds']:
                    self.expected_round_winners.append(game_round['winner'])
        else:
            self.game_name = 'random_game_' + common.random_string(5,5)
            # default to 6 random players
            for i in range(0,6):
                x = player.Player(self.server_url, self.game_name, verbose=verbose)
                self.players.append(x)

    def setup_players(self):
        [ p.event.wait() for p in self.players ]
        [ p.event.clear() for p in self.players ]

        [ p.setup_user() for p in self.players ]

        [ p.event.wait() for p in self.players ]
        [ p.event.clear() for p in self.players ]
        # Gime some time for lang and name to be setup
        time.sleep(0.2)

    def create_room(self):
        self.players[0].emit_new_room()

        self.players[0].event.wait()
        self.room_id = self.players[0].room_id

    def join_players(self):
        [ p.emit_join(self.room_id) for p in self.players[1:] ]

        [ p.event.wait() for p in self.players ]
        [ p.event.clear() for p in self.players ]

        # Give some time for the users to join
        # The server receives the event to start the game right after the last user joins, and
        # the server has not het added the user to the room jet, so the server complains
        # about minimal number of players, or starts the game without all players
        time.sleep(0.4)

    def start_game(self):
        self.players[0].emit_start()
        [ p.event.wait() for p in self.players ]
        [ p.event.clear() for p in self.players ]

        # Wait for server to create game and players
        time.sleep(0.2)

    def vote_persona(self):
        [ p.emit_vote_persona() for p in self.players ]

        [ p.event.wait() for p in self.players ]
        [ p.event.clear() for p in self.players ]

        # Wait for server to process persona
        time.sleep(0.8)

    def send_answers(self, i):
        for p in self.players:
            tht = threading.Thread(target=p.emit_answer, args=(i,))
            tht.start()

        # Wait for 'round answers' from server
        [ p.event.wait() for p in self.players ]
        [ p.event.clear() for p in self.players ]

        # Wait for server to process answers
        time.sleep(0.2)

    def vote_answers(self, i):
        [ p.emit_vote_answer(i) for p in self.players ]

        # Wait for 'round winner' from server
        [ p.event.wait() for p in self.players ]
        [ p.event.clear() for p in self.players ]

        # Wait for server to process  votes
        time.sleep(0.2)

    def disconnect_players(self):
        time.sleep(0.8)
        [ p.disconnect() for p in self.players ]

    def check_game_results(self):
        time.sleep(0.4)
        game_rounds = self.players[0].round_winners
        game_winner = self.players[0].game_winner

        print('Checking results: {}'.format(self.game_name))
        for i in range(self.n_rounds):
            if game_rounds[i] != self.expected_round_winners[i]:
                print('  Round {}: Expected {}, got {}'.format(
                    i, self.expected_round_winners[i], game_rounds[i]))
        if game_winner != self.expected_game_winner:
            print('  Game winner: Expected {}, got {}'.format(self.expected_game_winner, game_winner))

    def save_game_script(self):
        game = {}
        game['name'] = self.game_name
        p_list = []
        for player in self.players:
            player_data = {}
            player_data['name'] = player.name
            player_data['persona'] = player.persona
            player_data['rounds'] = player.round_data
            p_list.append(player_data)
        game['players'] = p_list

        result = {}
        result['rounds'] = [ {'winner': p } for p in self.players[0].round_winners ]
        result['game_winner'] = self.players[0].game_winner
        game['result'] = result

        game_file_name = '{}.yml'.format(self.game_name)
        print('Saving random game to {}'.format(game_file_name))
        with open('./{}'.format(game_file_name), 'w') as f:
            yaml.dump([game], f, sort_keys=False, default_flow_style=False)

    def play(self):
        self.setup_players()
        self.create_room()
        self.join_players()

        self.start_game()
        self.vote_persona()
        for i in range(self.n_rounds):
            self.send_answers(i)
            self.vote_answers(i)

        if self.expected_game_winner and self.expected_round_winners:
            self.check_game_results()
        else:
            self.save_game_script()

        self.disconnect_players()

    def debug(self):
        print(self)
        print(self.players)
