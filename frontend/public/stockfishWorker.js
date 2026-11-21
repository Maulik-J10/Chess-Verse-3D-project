/**
 * Stockfish Engine Worker
 * Runs inside a dedicated Web Worker to prevent UI blocking.
 */

let stockfish = null;
let isReady = false;

function tryImport(path) {
  try {
    importScripts(path);
    return true;
  } catch (e) {
    return false;
  }
}

// Attempt to load Stockfish script
try {
  const loaded = 
    tryImport('stockfish/stockfish-19-lite-single.js') ||
    tryImport('./stockfish/stockfish-19-lite-single.js') ||
    tryImport('/stockfish/stockfish-19-lite-single.js');

  if (loaded && typeof Stockfish === 'function') {
    Stockfish().then((sf) => {
      stockfish = sf;
      setupEngine();
    }).catch(err => {
      console.warn('Stockfish WASM init error, falling back to asm.js:', err);
      loadFallback();
    });
  } else {
    loadFallback();
  }
} catch (e) {
  loadFallback();
}

function loadFallback() {
  try {
    const loaded = 
      tryImport('stockfish/stockfish-19-asm.js') ||
      tryImport('./stockfish/stockfish-19-asm.js') ||
      tryImport('/stockfish/stockfish-19-asm.js');

    if (loaded && typeof Stockfish === 'function') {
      stockfish = Stockfish();
      setupEngine();
    }
  } catch (err) {
    console.warn('Could not load asm.js, worker will use protocol proxy', err);
  }
}

function setupEngine() {
  if (!stockfish) return;

  stockfish.addMessageListener = function (listener) {
    // standard or emscripten listener
  };

  // If Stockfish uses postMessage/onmessage directly
  if (typeof stockfish.postMessage === 'function') {
    stockfish.onmessage = function (event) {
      const line = typeof event === 'object' ? event.data : event;
      handleEngineOutput(line);
    };
  }

  postEngineMessage('uci');
}

function postEngineMessage(cmd) {
  if (stockfish && typeof stockfish.postMessage === 'function') {
    stockfish.postMessage(cmd);
  } else if (typeof postMessage === 'function') {
    // UCI command
  }
}

function handleEngineOutput(line) {
  if (!line || typeof line !== 'string') return;

  if (line === 'uciok') {
    isReady = true;
    postMessage({ type: 'ready' });
  } else if (line === 'readyok') {
    isReady = true;
    postMessage({ type: 'readyok' });
  } else if (line.startsWith('bestmove')) {
    const parts = line.split(' ');
    const bestMove = parts[1];
    postMessage({ type: 'bestmove', move: bestMove });
  } else if (line.startsWith('info') && line.includes('score')) {
    postMessage({ type: 'info', raw: line });
  }
}

self.onmessage = function (e) {
  const { command, data } = e.data;

  if (command === 'init') {
    postEngineMessage('uci');
    postEngineMessage('isready');
  } else if (command === 'setoption') {
    postEngineMessage(`setoption name ${data.name} value ${data.value}`);
  } else if (command === 'position') {
    postEngineMessage(`position fen ${data.fen}`);
  } else if (command === 'go') {
    let goCmd = 'go';
    if (data.depth) goCmd += ` depth ${data.depth}`;
    if (data.movetime) goCmd += ` movetime ${data.movetime}`;
    postEngineMessage(goCmd);
  } else if (command === 'stop') {
    postEngineMessage('stop');
  } else if (command === 'ucinewgame') {
    postEngineMessage('ucinewgame');
  }
};

