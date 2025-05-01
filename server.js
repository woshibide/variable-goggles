const express = require('express');
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');
const http = require('http');
const WebSocket = require('ws');
const chokidar = require('chokidar');

const app = express();
const PORT = process.env.PORT || 3000;

// create http server
const server = http.createServer(app);

// create websocket server
const wss = new WebSocket.Server({ server });

// serve static files
app.use(express.static('public'));
app.use('/data', express.static('data'));

// middleware for parsing json requests
app.use(express.json());

// helper function to safely get font name
const getFontName = (font) => {
  try {
    if (font.names.fullName && font.names.fullName.en) {
      return font.names.fullName.en;
    } else if (font.names.fontFamily && font.names.fontFamily.en) {
      return font.names.fontFamily.en;
    } else {
      // try any available name field
      for (const nameField of ['fullName', 'fontFamily', 'postScriptName', 'preferredFamily']) {
        if (font.names[nameField]) {
          const langEntry = Object.values(font.names[nameField])[0];
          if (langEntry) return langEntry;
        }
      }
      
      // fallback to first available name in any language
      for (const nameField in font.names) {
        const langValues = Object.values(font.names[nameField]);
        if (langValues && langValues.length > 0 && langValues[0]) {
          return langValues[0];
        }
      }
    }
  } catch (e) {
    console.error('error extracting font name:', e);
  }
  
  // if all else fails, return null
  return null;
};

// api endpoint to get available fonts
app.get('/api/fonts', (req, res) => {
  const fontsDir = path.join(__dirname, 'data', 'fonts');
  
  try {
    // read font directory
    const files = fs.readdirSync(fontsDir);
    
    // filter for font files
    const fonts = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.ttf', '.otf', '.woff', '.woff2'].includes(ext);
      })
      .map(file => {
        try {
          // try to get font name from font file
          const fontPath = path.join(fontsDir, file);
          const font = opentype.loadSync(fontPath);
          const fontName = getFontName(font) || path.basename(file, path.extname(file));
          
          // use sanitized font family name as id
          const fontId = fontName.replace(/[^a-z0-9]/gi, '') + '_' + Math.floor(Math.random() * 10000);
          
          return {
            name: fontName,
            path: `/data/fonts/${file}`,
            fontId: fontId
          };
        } catch (err) {
          // if there's an error, just use the filename as name
          console.error(`error reading font ${file}:`, err);
          return {
            name: path.basename(file, path.extname(file)),
            path: `/data/fonts/${file}`,
            fontId: 'font_' + Math.floor(Math.random() * 10000)
          };
        }
      });
    
    res.json({ fonts });
  } catch (error) {
    console.error('error reading fonts directory:', error);
    res.status(500).json({ error: 'failed to read fonts directory' });
  }
});

// api endpoint to get font info
app.get('/api/font/:fontPath', (req, res) => {
  try {
    const fontPath = path.join(__dirname, 'data', 'fonts', req.params.fontPath);
    const font = opentype.loadSync(fontPath);
    
    // extract variable font axes if available
    const axes = [];
    if (font.tables.fvar) {
      font.tables.fvar.axes.forEach(axis => {
        axes.push({
          tag: axis.tag,
          name: axis.name?.en || axis.tag,
          min: axis.minValue,
          max: axis.maxValue,
          default: axis.defaultValue
        });
      });
    }
    
    const fontName = getFontName(font) || path.basename(req.params.fontPath, path.extname(req.params.fontPath));
    const fontId = fontName.replace(/[^a-z0-9]/gi, '') + '_' + Math.floor(Math.random() * 10000);
    
    res.json({
      name: fontName,
      fontId: fontId,
      isVariable: !!font.tables.fvar,
      axes: axes
    });
  } catch (error) {
    console.error('error loading font:', error);
    res.status(500).json({ error: 'failed to load font information' });
  }
});

// api endpoint to check for new fonts
app.get('/api/fonts/check', (req, res) => {
  const fontsDir = path.join(__dirname, 'data', 'fonts');
  
  try {
    // read font directory
    const files = fs.readdirSync(fontsDir);
    
    // count font files
    const fontCount = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.ttf', '.otf', '.woff', '.woff2'].includes(ext);
    }).length;
    
    res.json({ count: fontCount });
  } catch (error) {
    console.error('error checking fonts directory:', error);
    res.status(500).json({ error: 'failed to check fonts directory' });
  }
});

// api endpoint to get available text files
app.get('/api/texts', (req, res) => {
  const textsDir = path.join(__dirname, 'data', 'text');
  
  try {
    // read text directory
    const files = fs.readdirSync(textsDir);
    
    // filter for text files
    const texts = files
      .filter(file => path.extname(file).toLowerCase() === '.txt')
      .map(file => {
        return {
          name: path.basename(file, path.extname(file)),
          path: `/data/text/${file}`
        };
      });
    
    res.json({ texts });
  } catch (error) {
    console.error('error reading texts directory:', error);
    res.status(500).json({ error: 'failed to read texts directory' });
  }
});

// serve index.html for all routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// set up file watchers
const setupWatchers = () => {
  // watch for changes in the fonts directory
  const fontsWatcher = chokidar.watch(path.join(__dirname, 'data', 'fonts'), {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  fontsWatcher.on('all', (event, path) => {
    // only care about add, change, unlink events
    if (event === 'add' || event === 'change' || event === 'unlink') {
      console.log(`font change detected: ${event} ${path}`);
      
      // notify all connected clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'fonts-changed'
          }));
        }
      });
    }
  });

  // watch for changes in the text directory
  const textsWatcher = chokidar.watch(path.join(__dirname, 'data', 'text'), {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  textsWatcher.on('all', (event, path) => {
    // only care about add, change, unlink events
    if (event === 'add' || event === 'change' || event === 'unlink') {
      console.log(`text change detected: ${event} ${path}`);
      
      // notify all connected clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'texts-changed'
          }));
        }
      });
    }
  });

  console.log('file watchers set up');
};

// handle websocket connections
wss.on('connection', (ws) => {
  console.log('new client connected');
  
  ws.on('close', () => {
    console.log('client disconnected');
  });
});

// start the server
server.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`);
  setupWatchers();
});