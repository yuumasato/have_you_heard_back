# Test

## Auto Player

The `auto_player.py` script can setup multiple players connecting to the server
and play Have you Heard games. The games can be prescripted or played randomly.

To play the prescripted games from the repository:
```
python3 ./auto_player.py -t
```

You can provide your own game script:
```
python3 ./auto_player.py -t ./my-game-play.yml
```
To play a random game:

```
python3 ./auto_player.py -r
```

Multiple random games can be played simultaneously by providing a number to `-r`:
```
python3 ./auto_player.py -r4
```

The data played during the random games are saved in a `.yml` and can be played
again as a prescripted games:
```
python3 ./auto_player.py -t ./random_game_XYZ.yml`
```
