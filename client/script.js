$$tiles = document.querySelectorAll('.tile');
$game = document.getElementById('game');
$board = document.getElementById('board');

Number.prototype.mod = function(n) {
    return ((this%n)+n)%n;
};

$$tiles.forEach(el => {
    let id = parseInt(el.getAttribute('data-id'));
    el.style.backgroundPosition = `${-id * 16}px 0px`;
});

var genericControlCallback = function (keycode) {
    console.log(keycode + 'button was pressed');
}

function btn1Callback() {
    if (message_queue.length) {
        popMessage();
    }
    else {

    }
}

function moveCallback(keycode) {
    let d = keycode == 38 ? 'up' : keycode == 40 ? 'down' : keycode == 37 ? 'left' : 'right';
    ws.send(JSON.stringify({ type: 'move', id: PLAYER.id, direction: d }));
}

// const CHUNK_SIZE = 10;

// function Chunk(x, y, tiles=undefined) {
//     this.x = x;
//     this.y = y;
//     this.tiles = tiles;
//     if (!this.tiles) {
//         for (let i = 0; i < CHUNK_SIZE ** 2; i++)
//             this.tiles.push(0);
//     }
// }

var sfx = {
    message_next: new Howl({ src: 'msg-next.wav' }),
    message_close: new Howl({ src: 'msg-close.wav' })
};

var Controls = [
    { el_id: 'btn1', keycode: 90, callback: btn1Callback },
    { el_id: 'btn2', keycode: 88, callback: genericControlCallback },
    { el_id: 'up', keycode: 38, callback: moveCallback },
    { el_id: 'down', keycode: 40, callback: moveCallback },
    { el_id: 'left', keycode: 37, callback: moveCallback },
    { el_id: 'right', keycode: 39, callback: moveCallback }
];

var setupControls = function () {
    for (let i = 0; i < Controls.length; i++) {
        let el = document.getElementById(Controls[i].el_id);
        el.onclick = Controls[i].callback;
        Controls[i].el = el;
    }
    document.onkeydown = ev => {
        for (let i = 0; i < Controls.length; i++) {
            if (Controls[i].keycode == ev.keyCode) {
                Controls[i].el.classList.add('pressed');
                Controls[i].callback(ev.keyCode);
            }
        }
    };
    document.onkeyup = ev => {
        for (let i = 0; i < Controls.length; i++) {
            if (Controls[i].keycode == ev.keyCode) {
                Controls[i].el.classList.remove('pressed');
            }
        }
    };
}();

$loadProgress = document.getElementById('load-progress');
$loadPercent = document.getElementById('load-percent');

function updateLoading(percent_normal) {
    percent_normal = Math.round(percent_normal * 10) / 10;
    updateTextElement($loadPercent, (percent_normal * 100) + '%');
    $loadProgress.style.width = (percent_normal * 64) + 'px';
}

function updateGlyphElement(el, char, dark, small) {
    let id = char.charCodeAt(0);
    let w = 6, h = 6, c = 20, o = 0, dark_o = 30;
    if (small) {
        w = 4;
        h = 5;
        c = 30;
        o = 60;
        dark_o = 80;
    }
    // if (id == 10) {
    //     id = 32;
    //     el.classList.add('newline');
    // }
    if (id == 32)
        el.classList.add('space');
    else {
        el.classList.remove('space');
        el.setAttribute('data-id', (id -= 32));
        el.style.backgroundPosition = `${-(id % c) * w}px ${-(Math.floor(id / c) * h) - (dark ? dark_o : o)}px`;
    }
    return el;
}

function createGlyphElement(char, dark, small) {
    let el = document.createElement('div');
    el.classList.add('glyph');
    return updateGlyphElement(el, char, dark, small);
}

function createWordElement(text, dark, small) {
    let el = document.createElement('span');
    el.classList.add('word');
    if (dark) el.classList.add('dark');
    if (small) el.classList.add('small');
    el.setAttribute('data-word', text);
    for (let i = 0; i < text.length; i++) {
        el.appendChild(createGlyphElement(text[i], dark, small));
    }
    return el;
}

function updateWordElement(el, text) {
    let i = 0, id = 0;
    let dark = el.classList.contains('dark');
    let small = el.classList.contains('small');
    el.querySelectorAll('.glyph').forEach(child => {
        if (i < text.length) {
            updateGlyphElement(child, text[i++], dark, small);
        }
        else child.remove();
    });
    for (; i < text.length; i++) {
        el.appendChild(createGlyphElement(text[i], dark, small));
    }
}

function createTextElement(text, dark, small) {
    let el = document.createElement('span');
    el.classList.add('text');
    if (dark) el.classList.add('dark');
    if (small) el.classList.add('small');
    el.setAttribute('data-text', text);
    let words = text.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
        el.appendChild(createWordElement(words[i], dark, small));
    }
}

function updateTextElement(el, text) {
    let i = 0;
    let dark = el.classList.contains('dark');
    let small = el.classList.contains('small');
    let words = text.split(/\s+/);
    el.querySelectorAll('.word').forEach(child => {
        if (i < words.length) {
            updateWordElement(child, words[i++], dark, small);
        }
        else child.remove();
    });
    for (; i < words.length; i++) {
        el.appendChild(createWordElement(words[i], dark, small));
    }
}

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

updateLoading(0.1);
setTimeout(() => { updateLoading(0.4 + getRandomArbitrary(0.1, 0.2)); }, 200 + getRandomArbitrary(0, 200));
setTimeout(() => { updateLoading(0.7 + getRandomArbitrary(0.1, 0.2)); }, 400 + getRandomArbitrary(0, 100));
setTimeout(() => { updateLoading(1.0); }, 500);
setTimeout(() => { $game.classList.remove('loading'); }, 550);

var message_queue = [];
$message = document.getElementById('message');

function pushMessage(text) {
    message_queue.push(text);
    if (message_queue.length == 1) {
        $message.classList.remove('hide');
        updateTextElement($message.querySelector('.text'), text, parseInt(window.getComputedStyle($message, null).getPropertyValue('width')));
    }
    else $message.classList.add('cont');
}

function popMessage() {
    if (message_queue.length > 1) {
        message_queue.shift();
        updateTextElement($message.querySelector('.text'), message_queue[0], parseInt(window.getComputedStyle($message, null).getPropertyValue('width')));
        $message.classList.add('bop');
        setTimeout(() => { $message.classList.remove('bop'); }, 50);
        sfx.message_next.play();
    }
    else if (message_queue.length == 1) {
        message_queue.pop();
        sfx.message_close.play();
    }
    if (message_queue.length == 1)
        $message.classList.remove('cont');
    else if (message_queue.length == 0)
        $message.classList.add('hide');
}

function Player(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
}

var Tiles = [];

var ws = new WebSocket('ws://127.0.0.1:5678/');

ws.onopen = ev => {
    ws.send(JSON.stringify({ type: 'join' }));
}

ws.onmessage = ev => {
    data = JSON.parse(ev.data);
    if (data.type == 'join') {
        PLAYER = new Player(data.session_id, data.position[0], data.position[1]);
        updateBoard((Tiles = data.tiles));
    }
    else if (data.type == 'move') {
        PLAYER.x = data.position[0];
        PLAYER.y = data.position[1];
        updateBoard((Tiles = data.tiles));
    }
    else if (data.error) {
        console.error('Error: ' + data.error);
    }
}

function join(callback) {
    
    // fetch('http://localhost:3002/join')
    //     .then(response => {
    //         return response.json();
    //     })
    //     .then(data => {
    //         let player = new Player(data.session_id, data.position[0], data.position[1]);
    //         Tiles = data.tiles;
    //         callback(player);
    //     });
}

// function get_chunk(cx, cy) {
//     for (let i = 0; i < Chunks.length; i++)
//         if (Chunks[i].x == cx && Chunks[i].y == cy)
//             return Chunks[i];
//     return null;
// }

// function get_tile(x, y) {
//     let cx = Math.floor(x / CHUNK_SIZE);
//     let cy = Math.floor(y / CHUNK_SIZE);
//     let chunk = get_chunk(cx, cy);
//     if (chunk == null) return null;
//     return chunk.tiles[y * CHUNK_SIZE + x];
// }

// function updateBoard(x, y) {
//     let tile_elements = $board.querySelectorAll('.tile');
//     let el, id, _x, _y;
//     for (let top = 0; top < 5; top++) {
//         for (let left = 0; left < 5; left++) {
//             _x = x - 2 + left;
//             _y = y - 2 + top;
//             id = get_tile(_x, _y);
//             el = tile_elements.item(top * 5 + left);
//             el.style.backgroundPosition = `${-id * 16}px 0px`;
//             el.setAttribute('data-id', id);
//         }
//     }
// }

function updateBoard(tiles) {
    let i = 0;
    $$tiles.forEach(el => {
        let id = tiles[i++];
        el.style.backgroundPosition = `${-id * 16}px 0px`;
        el.setAttribute('data-id', id);
    });
}

PLAYER = null;

// join(player => {
//     PLAYER = player;
//     updateBoard(Tiles);
// });