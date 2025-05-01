// main app controller
class VariableFontViewer {
  constructor() {
    // state
    this.state = {
      currentFont: null,
      currentFontPath: null,
      currentFontId: null,
      fonts: [],
      texts: [],
      fontInfo: null,
      axes: {},
      animatingAxes: {},
      text: 'The quick brown fox jumps over the lazy dog.',
      viewMode: 'text',
      fontSize: 48,
      lineHeight: 1.2,
      letterSpacing: 0,
      textColor: '#000000',
      backgroundColor: '#ffffff',
      fontCount: 0,
      hotReloadInterval: null,
      animationSpeed: 1,
      animationFrame: null,
      isAnimating: false,
      sidebarCollapsed: false 
    };

    // dom elements
    this.elements = {
      sidebar: document.querySelector('.sidebar'), 
      sidebarToggle: document.querySelector('.sidebar-toggle'), 
      fontSelector: document.getElementById('font-selector'),
      textSelector: document.getElementById('text-selector'),
      textInput: document.getElementById('text-input'),
      viewModeButtons: document.querySelectorAll('.view-mode'),
      views: {
        text: document.getElementById('text-view'),
        waterfall: document.getElementById('waterfall-view'),
        glyphs: document.getElementById('glyphs-view')
      },
      textDisplay: document.getElementById('text-display'),
      waterfallContainer: document.getElementById('waterfall-container'),
      glyphsGrid: document.getElementById('glyphs-grid'),
      fontSize: document.getElementById('font-size'),
      fontSizeInput: document.getElementById('font-size-input'),
      lineHeight: document.getElementById('line-height'),
      lineHeightInput: document.getElementById('line-height-input'),
      letterSpacing: document.getElementById('letter-spacing'),
      letterSpacingInput: document.getElementById('letter-spacing-input'),
      textColor: document.getElementById('text-color'),
      bgColor: document.getElementById('bg-color'),
      variableAxes: document.getElementById('variable-axes'),
      currentFontName: document.getElementById('current-font-name'),
      animateAll: document.getElementById('animate-all'),
      animationSpeed: document.getElementById('animation-speed'),
      animationSpeedInput: document.getElementById('animation-speed-input')
    };

    // initialize
    this.init();
  }

  async init() {
    // set initial text
    this.elements.textInput.value = this.state.text;
    
    // load fonts list
    await this.loadFonts();
    
    // load texts list
    await this.loadTexts();
    
    // set up event listeners
    this.setupEventListeners();
    
    // initialize view
    this.updateDisplay();

    // setup hot reload checking
    this.setupHotReload();
  }

  // periodically check for new fonts
  setupHotReload() {
    // replace polling with websocket connection
    try {
      // determine websocket URL (ws:// or wss:// depending on current protocol)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      // connect to websocket server
      this.socket = new WebSocket(wsUrl);
      
      // handle connection open
      this.socket.addEventListener('open', () => {
        console.log('websocket connection established');
      });
      
      // handle messages
      this.socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'fonts-changed') {
            console.log('font changes detected, reloading...');
            this.loadFonts();
          } else if (message.type === 'texts-changed') {
            console.log('text changes detected, reloading...');
            this.loadTexts();
          }
        } catch (error) {
          console.error('error handling websocket message:', error);
        }
      });
      
      // handle connection errors
      this.socket.addEventListener('error', (error) => {
        console.error('websocket error:', error);
        // fall back to polling if websocket fails
        this.fallbackToPolling();
      });
      
      // handle connection close
      this.socket.addEventListener('close', () => {
        console.log('websocket connection closed');
        // fall back to polling if websocket closes
        this.fallbackToPolling();
      });
    } catch (error) {
      console.error('error setting up websocket:', error);
      // fall back to polling if websocket setup fails
      this.fallbackToPolling();
    }
  }
  
  // fall back to traditional polling if websockets fail
  fallbackToPolling() {
    if (this.state.hotReloadInterval) return; // already polling
    
    console.log('falling back to polling for hot reload');
    this.state.hotReloadInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/fonts/check');
        const data = await response.json();
        
        if (data.count !== this.state.fontCount) {
          console.log('new fonts detected, reloading...');
          this.loadFonts();
        }
      } catch (error) {
        console.error('error checking for new fonts:', error);
      }
    }, 5000);
  }

  async loadFonts() {
    try {
      const response = await fetch('/api/fonts');
      const data = await response.json();
      
      if (data.fonts && data.fonts.length > 0) {
        this.state.fonts = data.fonts;
        this.state.fontCount = data.fonts.length;
        this.renderFontSelector();
        
        // if no font currently loaded, select the first one
        if (!this.state.currentFont && this.state.fonts.length > 0) {
          const firstFont = this.state.fonts[0];
          this.elements.fontSelector.value = firstFont.path;
          this.loadFont(firstFont.path);
        }
      }
    } catch (error) {
      console.error('error loading fonts:', error);
      alert('failed to load fonts. check console for details.');
    }
  }
  
  async loadTexts() {
    try {
      const response = await fetch('/api/texts');
      const data = await response.json();
      
      if (data.texts && data.texts.length > 0) {
        this.state.texts = data.texts;
        this.renderTextSelector();
      }
    } catch (error) {
      console.error('error loading texts:', error);
    }
  }

  renderFontSelector() {
    // store current selection
    const currentSelection = this.elements.fontSelector.value;
    
    // clear existing options
    this.elements.fontSelector.innerHTML = '';
    
    // add fonts to selector
    this.state.fonts.forEach(font => {
      const option = document.createElement('option');
      option.value = font.path;
      option.textContent = font.name;
      this.elements.fontSelector.appendChild(option);
    });

    // restore selection if it still exists
    if (currentSelection && this.state.fonts.some(f => f.path === currentSelection)) {
      this.elements.fontSelector.value = currentSelection;
    }
  }
  
  renderTextSelector() {
    // clear existing options
    this.elements.textSelector.innerHTML = '';
    
    // add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'select text';
    this.elements.textSelector.appendChild(defaultOption);
    
    // add texts to selector
    this.state.texts.forEach(text => {
      const option = document.createElement('option');
      option.value = text.path;
      option.textContent = text.name;
      this.elements.textSelector.appendChild(option);
    });
  }

  async loadFont(fontPath) {
    try {
      // get font filename from path
      const fontFile = fontPath.split('/').pop();
      
      // fetch font info
      const response = await fetch(`/api/font/${fontFile}`);
      const fontInfo = await response.json();
      
      // use fontId for consistent identification
      const fontId = fontInfo.fontId;
      
      this.state.currentFont = fontInfo.name;
      this.state.currentFontPath = fontPath;
      this.state.currentFontId = fontId;
      this.state.fontInfo = fontInfo;
      
      // update font name display
      this.elements.currentFontName.textContent = fontInfo.name || 'unknown';
      
      // check if font is already loaded
      let fontFaceExists = false;
      try {
        // try to match existing font face
        document.fonts.forEach(font => {
          if (font.family === fontId) {
            fontFaceExists = true;
          }
        });
      } catch (e) {
        // ignore errors in checking existing fonts
      }
      
      // load font if not already loaded
      if (!fontFaceExists) {
        try {
          // create a css rule for the font
          const style = document.createElement('style');
          style.textContent = `
            @font-face {
              font-family: "${fontId}";
              src: url("${fontPath}") format("truetype");
              font-weight: normal;
              font-style: normal;
            }
          `;
          document.head.appendChild(style);
          
          // wait for font to load
          const font = new FontFace(fontId, `url(${fontPath})`);
          await font.load();
          document.fonts.add(font);
          console.log(`font ${fontInfo.name} loaded successfully`);
        } catch (e) {
          console.error('error loading font face:', e);
          // continue anyway, the @font-face rule might work
        }
      }
      
      // setup variable axes
      this.setupVariableAxes(fontInfo);
      
      // update display with the new font
      this.updateDisplay();
      
    } catch (error) {
      console.error('error loading font:', error);
      alert('failed to load font. check console for details.');
    }
  }
  
  async loadTextFile(textPath) {
    try {
      const response = await fetch(textPath);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const text = await response.text();
      this.state.text = text;
      this.elements.textInput.value = text;
      this.updateDisplay();
    } catch (error) {
      console.error('error loading text file:', error);
    }
  }

  setupVariableAxes(fontInfo) {
    // stop any ongoing animations
    this.stopAllAxisAnimations();
    
    // reset axes state
    this.state.axes = {};
    this.state.animatingAxes = {};
    
    // clear previous axes controls
    this.elements.variableAxes.innerHTML = '<h2>variable axes</h2>';
    
    // check if this is a variable font
    if (!fontInfo.isVariable || !fontInfo.axes || fontInfo.axes.length === 0) {
      const noAxesMsg = document.createElement('div');
      noAxesMsg.className = 'no-axes-message';
      noAxesMsg.textContent = 'no variable axes available';
      this.elements.variableAxes.appendChild(noAxesMsg);
      return;
    }
    
    // create controls for each axis
    fontInfo.axes.forEach(axis => {
      // store axis values in state
      this.state.axes[axis.tag] = axis.default;
      this.state.animatingAxes[axis.tag] = false;
      
      // create control container
      const axisControl = document.createElement('div');
      axisControl.className = 'axis-control';
      axisControl.dataset.axis = axis.tag;
      
      // create header with name and tag
      const header = document.createElement('div');
      header.className = 'axis-header';
      
      const nameElem = document.createElement('div');
      nameElem.innerHTML = `<span class="axis-name">${axis.name}</span> <span class="axis-tag">(${axis.tag})</span>`;
      
      const valueElem = document.createElement('div');
      valueElem.className = 'axis-value';
      valueElem.textContent = axis.default.toFixed(2);
      
      header.appendChild(nameElem);
      header.appendChild(valueElem);
      
      // create range slider and number input
      const rangeContainer = document.createElement('div');
      rangeContainer.className = 'range-with-value';
      
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = axis.min;
      slider.max = axis.max;
      slider.step = (axis.max - axis.min) / 100;
      slider.value = axis.default;
      
      const numberInput = document.createElement('input');
      numberInput.type = 'number';
      numberInput.className = 'value-input';
      numberInput.min = axis.min;
      numberInput.max = axis.max;
      numberInput.step = slider.step;
      numberInput.value = axis.default;
      
      // add event listeners to controls
      slider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        this.state.axes[axis.tag] = value;
        valueElem.textContent = value.toFixed(2);
        numberInput.value = value;
        this.stopAxisAnimation(axis.tag);
        this.updateDisplay();
      });
      
      numberInput.addEventListener('input', (e) => {
        let value = parseFloat(e.target.value);
        
        // clamp value to valid range
        value = Math.max(axis.min, Math.min(value, axis.max));
        
        this.state.axes[axis.tag] = value;
        valueElem.textContent = value.toFixed(2);
        slider.value = value;
        this.stopAxisAnimation(axis.tag);
        this.updateDisplay();
      });
      
      rangeContainer.appendChild(slider);
      rangeContainer.appendChild(numberInput);
      
      // create action buttons
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'axis-actions';
      
      const resetButton = document.createElement('button');
      resetButton.className = 'button small';
      resetButton.textContent = 'reset';
      resetButton.addEventListener('click', () => {
        this.state.axes[axis.tag] = axis.default;
        valueElem.textContent = axis.default.toFixed(2);
        slider.value = axis.default;
        numberInput.value = axis.default;
        this.stopAxisAnimation(axis.tag);
        this.updateDisplay();
      });
      
      const animateButton = document.createElement('button');
      animateButton.className = 'button small';
      animateButton.textContent = 'animate';
      animateButton.addEventListener('click', () => {
        this.toggleAxisAnimation(axis.tag, axisControl, animateButton);
      });
      
      actionsContainer.appendChild(resetButton);
      actionsContainer.appendChild(animateButton);
      
      // add to dom
      axisControl.appendChild(header);
      axisControl.appendChild(rangeContainer);
      axisControl.appendChild(actionsContainer);
      this.elements.variableAxes.appendChild(axisControl);
    });
  }
  
  toggleAxisAnimation(axisTag, axisControl, button) {
    const isAnimating = this.state.animatingAxes[axisTag];
    
    if (isAnimating) {
      // stop animation
      this.stopAxisAnimation(axisTag);
      button.textContent = 'animate';
      axisControl.classList.remove('axis-animating');
    } else {
      // start animation
      this.state.animatingAxes[axisTag] = true;
      button.textContent = 'stop';
      axisControl.classList.add('axis-animating');
      
      // ensure animation loop is running
      if (!this.state.isAnimating) {
        this.state.isAnimating = true;
        this.animationLoop();
      }
    }
  }
  
  stopAxisAnimation(axisTag) {
    if (this.state.animatingAxes[axisTag]) {
      this.state.animatingAxes[axisTag] = false;
      
      // update UI
      const axisControl = this.elements.variableAxes.querySelector(`[data-axis="${axisTag}"]`);
      if (axisControl) {
        axisControl.classList.remove('axis-animating');
        const animateButton = axisControl.querySelector('.axis-actions button:last-child');
        if (animateButton) animateButton.textContent = 'animate';
      }
      
      // check if all animations stopped
      this.checkAllAnimationsStopped();
    }
  }
  
  stopAllAxisAnimations() {
    // stop animation loop
    this.state.isAnimating = false;
    if (this.state.animationFrame) {
      cancelAnimationFrame(this.state.animationFrame);
      this.state.animationFrame = null;
    }
    
    // reset all animations
    Object.keys(this.state.animatingAxes).forEach(axisTag => {
      this.state.animatingAxes[axisTag] = false;
    });
    
    // update UI
    const axisControls = this.elements.variableAxes.querySelectorAll('.axis-control');
    axisControls.forEach(control => {
      control.classList.remove('axis-animating');
      const animateButton = control.querySelector('.axis-actions button:last-child');
      if (animateButton) animateButton.textContent = 'animate';
    });
  }
  
  checkAllAnimationsStopped() {
    // check if any axes are still animating
    const stillAnimating = Object.values(this.state.animatingAxes).some(animating => animating);
    
    // if all animations have stopped, stop the animation loop
    if (!stillAnimating) {
      this.state.isAnimating = false;
      if (this.state.animationFrame) {
        cancelAnimationFrame(this.state.animationFrame);
        this.state.animationFrame = null;
      }
    }
  }
  
  animationLoop() {
    if (!this.state.isAnimating) return;
    
    const now = Date.now() / 1000;
    const speed = this.state.animationSpeed;
    const axes = this.state.fontInfo.axes;
    
    // update each animating axis
    for (const axisTag in this.state.animatingAxes) {
      if (this.state.animatingAxes[axisTag]) {
        const axis = axes.find(a => a.tag === axisTag);
        if (!axis) continue;
        
        // use sine wave for smooth animation
        const phase = Math.sin(now * speed * 2) * 0.5 + 0.5;
        const value = axis.min + (axis.max - axis.min) * phase;
        
        // update state and UI
        this.state.axes[axisTag] = value;
        
        const axisControl = this.elements.variableAxes.querySelector(`[data-axis="${axisTag}"]`);
        if (axisControl) {
          const valueElem = axisControl.querySelector('.axis-value');
          const slider = axisControl.querySelector('input[type="range"]');
          const numberInput = axisControl.querySelector('input[type="number"]');
          
          if (valueElem) valueElem.textContent = value.toFixed(2);
          if (slider) slider.value = value;
          if (numberInput) numberInput.value = value;
        }
      }
    }
    
    // update display
    this.updateDisplay();
    
    // continue animation loop
    this.state.animationFrame = requestAnimationFrame(() => this.animationLoop());
  }
  
  animateAllAxes() {
    const axisControls = this.elements.variableAxes.querySelectorAll('.axis-control');
    
    // toggle animation state
    const someAnimating = Object.values(this.state.animatingAxes).some(animating => animating);
    
    if (someAnimating) {
      // stop all animations
      this.stopAllAxisAnimations();
      this.elements.animateAll.textContent = 'animate all axes';
    } else {
      // start animations for all axes
      axisControls.forEach(control => {
        const axisTag = control.dataset.axis;
        const animateButton = control.querySelector('.axis-actions button:last-child');
        
        // start animation for this axis
        this.state.animatingAxes[axisTag] = true;
        control.classList.add('axis-animating');
        if (animateButton) animateButton.textContent = 'stop';
      });
      
      // update button text
      this.elements.animateAll.textContent = 'stop all animations';
      
      // start animation loop if not already running
      if (!this.state.isAnimating) {
        this.state.isAnimating = true;
        this.animationLoop();
      }
    }
  }

  setupEventListeners() {
    // font selector
    this.elements.fontSelector.addEventListener('change', (e) => {
      this.loadFont(e.target.value);
    });
    
    // text selector
    this.elements.textSelector.addEventListener('change', (e) => {
      if (e.target.value) {
        this.loadTextFile(e.target.value);
      }
    });
    
    // text input
    this.elements.textInput.addEventListener('input', (e) => {
      this.state.text = e.target.value;
      this.updateDisplay();
    });
    
    // view mode buttons
    this.elements.viewModeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        this.changeViewMode(mode);
      });
    });
    
    // font size
    this.elements.fontSize.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.state.fontSize = value;
      this.elements.fontSizeInput.value = value;
      this.updateDisplay();
    });
    
    this.elements.fontSizeInput.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (!isNaN(value)) {
        this.state.fontSize = Math.max(8, Math.min(200, value));
        this.elements.fontSize.value = this.state.fontSize;
        this.updateDisplay();
      }
    });
    
    // line height
    this.elements.lineHeight.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.state.lineHeight = value;
      this.elements.lineHeightInput.value = value;
      this.updateDisplay();
    });
    
    this.elements.lineHeightInput.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value)) {
        this.state.lineHeight = Math.max(0.7, Math.min(2, value));
        this.elements.lineHeight.value = this.state.lineHeight;
        this.updateDisplay();
      }
    });
    
    // letter spacing
    this.elements.letterSpacing.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.state.letterSpacing = value;
      this.elements.letterSpacingInput.value = value;
      this.updateDisplay();
    });
    
    this.elements.letterSpacingInput.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value)) {
        this.state.letterSpacing = Math.max(-0.1, Math.min(0.5, value));
        this.elements.letterSpacing.value = this.state.letterSpacing;
        this.updateDisplay();
      }
    });
    
    // colors
    this.elements.textColor.addEventListener('input', (e) => {
      this.state.textColor = e.target.value;
      this.updateDisplay();
    });
    
    this.elements.bgColor.addEventListener('input', (e) => {
      this.state.backgroundColor = e.target.value;
      this.updateDisplay();
    });
    
    // animation speed
    this.elements.animationSpeed.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.state.animationSpeed = value;
      this.elements.animationSpeedInput.value = value;
    });
    
    this.elements.animationSpeedInput.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value)) {
        this.state.animationSpeed = Math.max(0.5, Math.min(5, value));
        this.elements.animationSpeed.value = this.state.animationSpeed;
      }
    });
    
    // animate all button
    this.elements.animateAll.addEventListener('click', () => {
      this.animateAllAxes();
    });

    // sidebar toggle button
    this.elements.sidebarToggle.addEventListener('click', () => {
      // toggle the collapsed state
      this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
      
      // apply class to sidebar
      this.elements.sidebar.classList.toggle('collapsed', this.state.sidebarCollapsed);
      
      // update the toggle button text to show the appropriate arrow
      this.elements.sidebarToggle.innerHTML = this.state.sidebarCollapsed ? '&lsaquo;' : '&rsaquo;';
      
      // update tooltip to indicate what will happen on next click
      this.elements.sidebarToggle.setAttribute('title', 
        this.state.sidebarCollapsed ? 'expand sidebar' : 'collapse sidebar');
      
      // ensure the button remains visible
      this.elements.sidebarToggle.style.display = 'flex';
      
      // log state for debugging
      console.log('sidebar toggled, collapsed state:', this.state.sidebarCollapsed);
    });
    
    // cleanup event handler
    window.addEventListener('beforeunload', () => {
      if (this.state.hotReloadInterval) {
        clearInterval(this.state.hotReloadInterval);
      }
      
      if (this.state.animationFrame) {
        cancelAnimationFrame(this.state.animationFrame);
      }
    });
  }

  changeViewMode(mode) {
    // update state
    this.state.viewMode = mode;
    
    // update active button
    this.elements.viewModeButtons.forEach(button => {
      if (button.dataset.mode === mode) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // update active view
    Object.keys(this.elements.views).forEach(key => {
      if (key === mode) {
        this.elements.views[key].classList.add('active');
      } else {
        this.elements.views[key].classList.remove('active');
      }
    });
    
    // initialize the view if needed
    if (mode === 'waterfall') {
      this.renderWaterfallView();
    } else if (mode === 'glyphs') {
      this.renderGlyphsView();
    }
  }

  generateFontVariationSettings() {
    if (Object.keys(this.state.axes).length === 0) return '';
    
    const settingsParts = [];
    for (const [tag, value] of Object.entries(this.state.axes)) {
      settingsParts.push(`"${tag}" ${value.toFixed(2)}`);
    }
    
    return settingsParts.join(', ');
  }

  updateDisplay() {
    // skip if no font is loaded
    if (!this.state.currentFontId) return;
    
    // prepare font style
    const fontStyle = {
      fontFamily: `"${this.state.currentFontId}", sans-serif`,
      fontSize: `${this.state.fontSize}px`,
      lineHeight: this.state.lineHeight,
      letterSpacing: `${this.state.letterSpacing}em`,
      color: this.state.textColor
    };
    
    // add variable font settings if applicable
    const variationSettings = this.generateFontVariationSettings();
    if (variationSettings) {
      fontStyle.fontVariationSettings = variationSettings;
    }
    
    // apply style to content area
    document.querySelector('.content').style.backgroundColor = this.state.backgroundColor;
    
    // update text display
    this.elements.textDisplay.style.fontFamily = fontStyle.fontFamily;
    this.elements.textDisplay.style.fontSize = fontStyle.fontSize;
    this.elements.textDisplay.style.lineHeight = fontStyle.lineHeight;
    this.elements.textDisplay.style.letterSpacing = fontStyle.letterSpacing;
    this.elements.textDisplay.style.color = fontStyle.color;
    this.elements.textDisplay.style.fontVariationSettings = fontStyle.fontVariationSettings;
    this.elements.textDisplay.textContent = this.state.text || 'enter text to preview...';
    
    // update other views if active
    if (this.state.viewMode === 'waterfall') {
      this.renderWaterfallView();
    } else if (this.state.viewMode === 'glyphs') {
      this.renderGlyphsView();
    }
  }

  renderWaterfallView() {
    // skip if no font is loaded
    if (!this.state.currentFontId) return;
    
    // clear container
    this.elements.waterfallContainer.innerHTML = '';
    
    // font sizes for waterfall view
    const sizes = [8, 12, 16, 20, 24, 32, 48, 60, 72, 96, 120];
    
    // create rows for each size
    sizes.forEach(size => {
      const row = document.createElement('div');
      row.className = 'waterfall-row';
      
      const sizeLabel = document.createElement('div');
      sizeLabel.className = 'waterfall-size';
      sizeLabel.textContent = `${size}px`;
      
      const textDisplay = document.createElement('div');
      textDisplay.style.fontFamily = `"${this.state.currentFontId}", sans-serif`;
      textDisplay.style.fontSize = `${size}px`;
      textDisplay.style.lineHeight = this.state.lineHeight;
      textDisplay.style.letterSpacing = `${this.state.letterSpacing}em`;
      textDisplay.style.color = this.state.textColor;
      textDisplay.style.fontVariationSettings = this.generateFontVariationSettings();
      textDisplay.textContent = this.state.text?.length > 100 
        ? this.state.text.substring(0, 100) + '...' 
        : (this.state.text || 'The quick brown fox jumps over the lazy dog!');
      
      row.appendChild(sizeLabel);
      row.appendChild(textDisplay);
      
      this.elements.waterfallContainer.appendChild(row);
    });
  }

  renderGlyphsView() {
    // skip if no font is loaded
    if (!this.state.currentFontId) return;
    
    // clear container
    this.elements.glyphsGrid.innerHTML = '';
    
    // basic latin characters for glyphs view
    const basicLatinRange = [
      { start: 32, end: 126 }  // space to tilde
    ];
    
    // create a cell for each character
    basicLatinRange.forEach(range => {
      for (let i = range.start; i <= range.end; i++) {
        const char = String.fromCharCode(i);
        
        const glyphItem = document.createElement('div');
        glyphItem.className = 'glyph-item';
        
        const charDisplay = document.createElement('div');
        charDisplay.className = 'glyph-char';
        charDisplay.style.fontFamily = `"${this.state.currentFontId}", sans-serif`;
        charDisplay.style.fontVariationSettings = this.generateFontVariationSettings();
        charDisplay.textContent = char;
        
        const charName = document.createElement('div');
        charName.className = 'glyph-name';
        charName.textContent = `U+${i.toString(16).toUpperCase().padStart(4, '0')}`;
        
        glyphItem.appendChild(charDisplay);
        glyphItem.appendChild(charName);
        
        this.elements.glyphsGrid.appendChild(glyphItem);
      }
    });
  }
}

// initialize app when dom is loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new VariableFontViewer();
});