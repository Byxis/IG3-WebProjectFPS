/**
 * Sound Manager for handling all game audio
 * Manages sound pools to prevent audio cutoff when playing sounds rapidly
 */
class SoundManager {
  constructor() {
    this.poolSize = 3;
    this.masterVolume = 1.0;

    this.volumeSettings = {
      hitmarker: 1.0,
      headshot: 0.7,
      damage: 1.0,
      shot: 0.05,
      dryFire: 0.2,
      dryFireHigh: 0.05,
      reload: 0.08,
      empty: 1.0
    };
    
    this.sounds = {
      hitmarker: {
        pool: this.createSoundPool('../sounds/hitmarker.mp3', this.poolSize),
        currentIndex: 0
      },
      headshot: {
        pool: this.createSoundPool('../sounds/headshot.mp3', this.poolSize),
        currentIndex: 0
      },
      damage: {
        pool: this.createSoundPool('../sounds/ouch.mp3', this.poolSize),
        currentIndex: 0
      },
      shot: {
        pool: this.createSoundPool('../sounds/shot.mp3', this.poolSize),
        currentIndex: 0
      },
      dryFire: {
        pool: this.createSoundPool('../sounds/dry-fire.mp3', this.poolSize),
        currentIndex: 0
      },
      dryFireHigh: {
        pool: this.createSoundPool('../sounds/dry-fire-high.mp3', this.poolSize),
        currentIndex: 0
      },
      reload: {
        pool: this.createSoundPool('../sounds/reload.mp3', this.poolSize),
        currentIndex: 0
      },
      empty: {
        pool: this.createSoundPool('../sounds/empty.mp3', this.poolSize),
        currentIndex: 0
      }
    };
    
    this.applyVolumeSettings();
  }

  /**
   * Creates a pool of audio elements for a sound
   * @param {string} src - Path to the sound file
   * @param {number} size - Size of the pool
   * @returns {HTMLAudioElement[]} - Array of audio elements
   */
  createSoundPool(src, size) {
    const pool = [];
    for (let i = 0; i < size; i++) {
      const audio = new Audio(src);
      pool.push(audio);
    }
    return pool;
  }

  /**
   * Gets the next available sound from a pool
   * @param {string} soundName - Name of the sound to play
   * @returns {HTMLAudioElement} Next available sound in the pool
   */
  getNextSound(soundName) {
    if (!this.sounds[soundName]) {
      console.error(`Sound "${soundName}" not found`);
      return null;
    }

    const soundObj = this.sounds[soundName];
    const sound = soundObj.pool[soundObj.currentIndex];

    soundObj.currentIndex = (soundObj.currentIndex + 1) % soundObj.pool.length;
    
    return sound;
  }

  /**
   * Plays a sound by name
   * @param {string} soundName - Name of the sound to play
   */
  playSound(soundName) {
    const sound = this.getNextSound(soundName);
    if (sound) {
      const specificVolume = this.volumeSettings[soundName] || 1.0;

      sound.volume = this.masterVolume * specificVolume;
      sound.currentTime = 0;
      sound.play().catch(e => console.error(`Error playing ${soundName} sound:`, e));
    }
  }

  /**
   * Sets the master volume for all sounds
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.applyVolumeSettings();
  }

  /**
   * Sets the volume for a specific sound type
   * @param {string} soundName - Name of the sound type
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  setSoundVolume(soundName, volume) {
    if (this.sounds[soundName]) {
      this.volumeSettings[soundName] = Math.max(0, Math.min(1, volume));
      this.applyVolumeToSoundPool(soundName);
    } else {
      console.error(`Sound type "${soundName}" not found`);
    }
  }

  /**
   * Applies current volume settings to all sound pools
   */
  applyVolumeSettings() {
    for (const soundName in this.sounds) {
      this.applyVolumeToSoundPool(soundName);
    }
  }

  /**
   * Applies volume setting to a specific sound pool
   * @param {string} soundName - Name of the sound type
   */
  applyVolumeToSoundPool(soundName) {
    if (!this.sounds[soundName]) return;
    
    const specificVolume = this.volumeSettings[soundName] || 1.0;
    const finalVolume = this.masterVolume * specificVolume;
    
    this.sounds[soundName].pool.forEach(audio => {
      audio.volume = finalVolume;
    });
  }

  /**
   * Gets the current master volume
   * @returns {number} Current master volume (0.0 to 1.0)
   */
  getMasterVolume() {
    return this.masterVolume;
  }

  /**
   * Gets the volume for a specific sound type
   * @param {string} soundName - Name of the sound type
   * @returns {number} Current sound volume (0.0 to 1.0)
   */
  getSoundVolume(soundName) {
    return this.volumeSettings[soundName] || 1.0;
  }
  
  /**
   * Plays the hitmarker sound (when hitting an enemy)
   */
  playHitmarker() {
    this.playSound('hitmarker');
  }

  /**
   * Plays the headshot sound (when hitting an enemy's head)
   */
  playHeadshot() {
    this.playSound('headshot');
  }

  /**
   * Plays the damage sound (when player takes damage)
   */
  playDamage() {
    this.playSound('damage');
  }

  /**
   * Plays the reload sound
   */
  playReload() {
    this.playSound('reload');
  }

  /**
   * Plays the empty gun sound
   */
  playEmptyGun() {
    this.playSound('empty');
  }

 /**
  * Plays the gunshot sound (when player shoots)
  */
  playGunshot() {
    this.playSound('shot');
  }

    /**
     * Plays the dry fire sound 
     */
    playDryFire() {
        this.playSound('dryFire');
    }

    /**
     * Plays the high dry fire sound 
     */
    playDryFireHigh() {
        this.playSound('dryFireHigh');
    }
}

const soundManager = new SoundManager();
export default soundManager;
