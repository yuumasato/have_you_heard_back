import random
import string

def random_int(min_int, max_int):
    return random.randint(min_int, max_int)

def random_string(min_length, max_length):
    char_set = string.ascii_letters + string.digits + ' '
    answer_length = random.randint(min_length, max_length)
    return ''.join(random.choices(char_set, k=answer_length))
