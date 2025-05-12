export class BackgroundManager {
  constructor() {
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this.shapeContainers = [];
    this.isLoaded = false;
    this.animateParallax = this.animateParallax.bind(this);
    this.resizeTimeout = null; // Pour le debouncing du resize
    this.throttleTimeout = null;
    this.isResizing = false;
  }
  
  /**
   ** Initializes the background manager by loading templates and setting up event listeners.
   * Fetches the background HTML template, inserts it into the DOM, and sets up shape positioning.
   * @returns {Promise<void>} - A promise that resolves when initialization is complete.
   */
  async init() {
    try {
      const response = await fetch('/templates/background.html');
      const html = await response.text();
      
      document.body.insertAdjacentHTML('afterbegin', html);
      
      this.shapeContainers = document.querySelectorAll('.shape-container');
      document.addEventListener('mousemove', this.handleMouseMove.bind(this));
      window.addEventListener('resize', this.handleResize.bind(this));
      window.addEventListener('orientationchange', this.handleResize.bind(this));
      
      this.isLoaded = true;
      
      this.shapeContainers.forEach(container => {
        container.style.transition = 'left 0.5s ease-out, top 0.5s ease-out';
      });
      
      this.randomizeShapePositions();
      this.animateParallax();
      
      setTimeout(() => {
        const event = new MouseEvent('mousemove', {
          clientX: window.innerWidth / 2 + 100,
          clientY: window.innerHeight / 2 + 100
        });
        document.dispatchEvent(event);
      }, 100);
    } catch (error) {
      console.error('Failed to initialize background:', error);
    }
  }
  
  /**
   ** Randomizes the positions of shape containers within a grid layout.
   * Divides the viewport into a grid and places shapes strategically for optimal coverage.
   * Applies random animation delays between 0 and 2 seconds to each shape.
   * @param {boolean} useTransition - Whether to use CSS transitions for smooth movement.
   * @returns {void}
   */
  randomizeShapePositions(useTransition = false) {
    if (!this.isLoaded || !this.shapeContainers.length) {
      return;
    }
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const totalShapes = this.shapeContainers.length;
    const gridDimension = Math.ceil(Math.sqrt(totalShapes));
    
    const cellWidth = viewportWidth / gridDimension;
    const cellHeight = viewportHeight / gridDimension;
    
    const gridPositions = [];
    for (let row = 0; row < gridDimension; row++) {
      for (let col = 0; col < gridDimension; col++) {
        gridPositions.push({row, col});
      }
    }
    
    this.shuffleArray(gridPositions);
    
    this.prevWidth = viewportWidth;
    this.prevHeight = viewportHeight;
    
    this.shapeContainers.forEach((container, index) => {
      if (!useTransition) {
        container.style.transition = 'none';
        container.offsetHeight;
      } else {
        container.style.transition = 'left 0.5s ease-out, top 0.5s ease-out';
      }
      
      if (index < gridPositions.length) {
        const position = gridPositions[index];
        const baseX = position.col * cellWidth;
        const baseY = position.row * cellHeight;

        const prcCellSize = Math.random() * 0.2 + 0.8;
        const offsetX = Math.random() * cellWidth * prcCellSize;
        const offsetY = Math.random() * cellHeight * prcCellSize;
        
        container.style.left = `${baseX + offsetX}px`;
        container.style.top = `${baseY + offsetY}px`;
        
        const randomDelay = Math.random() * 2;
        container.style.animationDelay = `${randomDelay}s`;
      } else {
        const randomX = Math.random() * viewportWidth;
        const randomY = Math.random() * viewportHeight;
        
        container.style.left = `${randomX}px`;
        container.style.top = `${randomY}px`;
        
        const randomDelay = Math.random() * 2;
        container.style.animationDelay = `${randomDelay}s`;
      }
      
      if (!useTransition) {
        setTimeout(() => {
          container.style.transition = 'left 0.5s ease-out, top 0.5s ease-out';
        }, 50);
      }
    });
  }
  
  /**
   ** Ajuste rapidement les positions pendant le redimensionnement actif.
   * Version simplifiée et plus rapide que randomizeShapePositions.
   * @returns {void}
   */
  adjustPositionsForResize() {
    if (!this.isLoaded || !this.shapeContainers.length) {
      return;
    }
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    this.shapeContainers.forEach(container => {
      const currentLeft = parseInt(container.style.left);
      const currentTop = parseInt(container.style.top);
      
      const percentX = currentLeft / this.prevWidth || 0.5;
      const percentY = currentTop / this.prevHeight || 0.5;
      
      container.style.left = `${percentX * viewportWidth}px`;
      container.style.top = `${percentY * viewportHeight}px`;
    });
    
    this.prevWidth = viewportWidth;
    this.prevHeight = viewportHeight;
  }
  
  /**
   ** Handles window resize events with a hybrid approach for smooth transitions.
   * Uses throttling during active resize and debouncing for final positioning.
   * @returns {void}
   */
  handleResize() {
    this.isResizing = true;
    
    if (!this.throttleTimeout) {
      this.throttleTimeout = setTimeout(() => {
        this.adjustPositionsForResize();
        this.throttleTimeout = null;
        
        if (this.isResizing) {
          this.handleResize();
        }
      }, 100);
    }
    
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.isResizing = false;
      this.randomizeShapePositions(true);
    }, 200);
  }
  
  /**
   ** Shuffles an array using the Fisher-Yates algorithm.
   * @param {Array} array - The array to shuffle.
   * @returns {Array} - The shuffled array.
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
  /**
   ** Handles mouse movement events by updating the stored mouse coordinates.
   * @param {MouseEvent} e - The mouse event object containing client coordinates.
   * @returns {void}
   */
  handleMouseMove(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  }
  
  /**
   ** Animates the parallax effect based on mouse position.
   * Creates depth perception by moving shapes at different rates relative to mouse position.
   * Uses requestAnimationFrame for smooth animation.
   * @returns {void}
   */
  animateParallax() {
    if (!this.isLoaded) {
      console.warn('Animation attempted before loading completed');
      return;
    }
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    const targetX = (this.mouseX - centerX) / centerX;
    const targetY = (this.mouseY - centerY) / centerY;
    
    this.shapeContainers.forEach(container => {
      const shape = container.querySelector('.shape');
      
      if (!shape) {
        return;
      }
      
      let depthFactor;
      if (shape.classList.contains('tiny')) {
        depthFactor = 8;
      } else if (shape.classList.contains('small')) {
        depthFactor = 15;
      } else {
        depthFactor = 25;
      }
      
      const translateX = targetX * depthFactor;
      const translateY = targetY * depthFactor;
      container.style.transform = `translate(${translateX}px, ${translateY}px)`;
    });
    
    requestAnimationFrame(this.animateParallax);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!window.backgroundManager) {
    window.backgroundManager = new BackgroundManager();
    window.backgroundManager.init();
  }
});
