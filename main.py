import uvicorn
import inflect
import random
import logging
import ujson as json
import sys
import os
import websockets
import asyncio
from uuid import uuid4 as uuid
from opensimplex import OpenSimplex

import yaml
try:
    from yaml import CSafeLoader as Loader, CSafeDumper as Dumper
except ImportError:
    from yaml import SafeLoader as Loader, SafeDumper as Dumper

# app = Application()
p = inflect.engine()

WEBSOCKET_IP = '127.0.0.1'
WEBSOCKET_PORT = 5678
WEBSOCKET_URI = f'ws://{WEBSOCKET_IP}:{WEBSOCKET_PORT}/'
CHUNK_SIZE = 10

class Chunk(object):
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.modified = False
        self.tiles = [ 0 for _ in range(0, CHUNK_SIZE ** 2) ]
    def set_tile(self, x, y, id):
        self.tiles[y * CHUNK_SIZE + x] = id
        self.modified = True
    def get_tile(self, x, y):
        return self.tiles[y * CHUNK_SIZE + x]
    def get_dict(self):
        return {
            'x': self.x,
            'y': self.y,
            'tiles': self.tiles
        }

class World(object):
    def __init__(self, seed):
        self.chunks = []
        self.rng = random.Random(seed)
        self.biome_noisemap = OpenSimplex(self.rng.randint(0, 99999999))
        self.forest_noisemap = OpenSimplex(self.rng.randint(0, 99999999))
        self.grass_noisemap = OpenSimplex(self.rng.randint(0, 99999999))
        self.lake_noisemap = OpenSimplex(self.rng.randint(0, 99999999))
        self.stream_noisemap = OpenSimplex(self.rng.randint(0, 99999999))
    def get_forest(self, x, y):
        if self.rng.randint(0, 3) == 0:
            return 2
        n = self.forest_noisemap.noise2(x / 5.0, y / 5.0)
        if n > 0.1:
            if n < 0.2:
                return 0 if self.rng.randint(0, 2) == 0 else 5
            elif self.rng.randint(0, 3) > 0:
                return 2
            else:
                return self.rng.choice([ 3, 5, 0, 0, 0, 6, 7 ])
        else:
            return 0
    def get_biome(self, x, y):
        n = self.biome_noisemap.noise2(x/ 12.0, y / 12.0) * 100
        if n > 16:
            return 1, n
        elif n > 5 and n < 12:
            return 2, n
        elif n < -36:
            return 3, n
        return 0, n
    def get_lake(self, x, y, n):
        return 9 if n > -44 else 8
    def get_grass(self, x, y):
        return self.rng.choice([ 5, 5, 5, 4, 4, 6, 7 ])
    def get_chunk(self, x, y):
        for c in self.chunks:
            if c.x == x and c.y == y:
                return c
        self.chunks.append(Chunk(x, y))
        for _y in range(0, CHUNK_SIZE):
            for _x in range(0, CHUNK_SIZE):
                xx = (x * CHUNK_SIZE) + _x
                yy = (y * CHUNK_SIZE) + _y
                t = 0
                biome, n = self.get_biome(xx, yy)
                if biome == 1:
                    t = self.get_forest(xx, yy)
                elif biome == 2:
                    t = self.get_grass(xx, yy)
                elif biome == 3:
                    t = self.get_lake(xx, yy, n)
                self.chunks[-1].tiles[_y * CHUNK_SIZE + _x] = t
        return self.chunks[-1]
    def get_tile(self, x, y):
        chunk = self.get_chunk(int(x / CHUNK_SIZE), int(y / CHUNK_SIZE))
        return chunk.get_tile(x % 10, y % 10)

WORLD = World('test')

class Session(object):
    def __init__(self, ip):
        self.ip = ip
        self.id = ''.join(str(uuid())[:8].split('-')).upper()
        self.x = 0
        self.y = 0
        self.last_cx = 0
        self.last_cy = 0

Sessions = []

def get_tile_area(world, x, y, size):
    tiles = [ 0 for _ in range(0, size * size) ]
    for _y in range(0, size):
        for _x in range(0, size):
            tiles[_y * size + _x] = world.get_tile(x + _x, y + _y)
    return tiles

def get_session(id):
    for i in range(0, len(Sessions)):
        if Sessions[i].id == id:
            return Sessions[i]
    return None

async def ws_handler(ws, path):
    while True:
        data = await ws.recv()
        data = json.loads(data)
        if data['type'] == 'move':
            session = get_session(data['id'])
            if not session:
                await ws.send(json.dumps({
                    'error': f'invalid session id "{data["id"]}"'
                }))
            else:
                if data['direction'] == 'up':
                    session.y -= 1
                elif data['direction'] == 'down':
                    session.y += 1
                elif data['direction'] == 'left':
                    session.x -= 1
                elif data['direction'] == 'right':
                    session.x += 1
                print(len(WORLD.chunks))
                print(f'player pos {session.x} {session.y}, chunk {int(session.x / CHUNK_SIZE)} {int(session.y / CHUNK_SIZE)}')
                await ws.send(json.dumps({
                    'type': 'move',
                    'position': [ session.x, session.y ],
                    'tiles': get_tile_area(WORLD, session.x - 2, session.y - 2, 5)
                }))
        elif data['type'] == 'join':
            session = None
            ip = ws.remote_address[0]
            for s in Sessions:
                if s.ip == ip:
                    session = s
            if not session:
                Sessions.append(Session(ip))
                session = Sessions[-1]
            print(len(WORLD.chunks))
            await ws.send(json.dumps({
                'type': 'join',
                'session_id': session.id,
                'position': [ session.x, session.y ],
                'tiles': get_tile_area(WORLD, session.x - 2, session.y - 2, 5)
            }))
        else:
            await ws.send(json.dumps({
                'error': f'unknown action"{path}"'
            }))

for y in range(0, 150):
    for x in range(0, 150):
        t = WORLD.get_tile(x, y)
        print(' ' if t == 0 else t, end='')
    print()

ws_server = websockets.serve(ws_handler, "127.0.0.1", 5678)

loop = asyncio.get_event_loop()
loop.run_until_complete(ws_server)
loop.run_forever()

# app.on_start += before_start

# if 'debug' in sys.argv:
#     logging.basicConfig(
#         level=logging.DEBUG,
#         format='%(levelname)s %(message)s - %(asctime)s'
#     )
#     app.use_sync_logging()

# uvicorn.run(app, port=3002, log_level='info')