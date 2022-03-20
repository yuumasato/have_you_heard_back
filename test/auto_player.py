import argparse
import threading
import os
import yaml

from auto_player import game_coordinator


def parse_args():
    p = argparse.ArgumentParser(description="Run test games based on the test data.")

    p.add_argument('-v', '--verbose', action='store_true')
    p.add_argument('-s', '--server', action='store', default="http://haveyouheard.fun")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument('-t', '--test-set', nargs='?', const="./test/games")
    g.add_argument('-r', '--random-set', nargs='?', const=1, type=int)

    return p.parse_args()


def load_test_set(set_path):
    return yaml.load(open(set_path), Loader=yaml.FullLoader)

def load_test_data(source_path):
    test_data = []
    print('Test using:')
    if os.path.isdir(source_path):
        for file in os.listdir(source_path):
            if file.endswith('.yml'):
                test_path= os.path.join(source_path, file)
                print('  - '+test_path)
                test_data = test_data + load_test_set(test_path)
    elif os.path.isfile(source_path):
        if source_path.endswith('.yml'):
            print('  - ' + source_path)
            test_data = load_test_set(source_path)
        else:
            raise Exception('Error: {} file is not a yaml file'.format(source_path))

    return test_data

def main():
    args = parse_args()

    if args.random_set:
        print('Test using {} random data set(s)'.format(args.random_set))
        for i in range(0, args.random_set):
            gc = game_coordinator.GameCoordinator(args.server, verbose=args.verbose)
            tht = threading.Thread(target=gc.play)
            tht.start()
    elif args.test_set:
        test_data = load_test_data(args.test_set)

        for test_datum in test_data:
            gc = game_coordinator.GameCoordinator(args.server, test_datum, verbose=args.verbose)
            tht = threading.Thread(target=gc.play)
            tht.start()


if __name__ == "__main__":
    main()
