import React, { useEffect, useRef } from 'react';

export default function CorporateChase() {
  const gameRef = useRef(null);

  useEffect(() => {
    console.log('🥽 Phaser wrapper mounted');
    let game;

    (async () => {
      const PhaserModule = await import('phaser');
      const Phaser = PhaserModule.default;
      console.log('⚡ Phaser loaded', Phaser);

      // BootScene: start GameScene immediately for debugging
      class BootScene extends Phaser.Scene {
        constructor() { super({ key: 'BootScene' }); }
        preload() {
          this.load.image('office', '/assets/tiles/office-floor.png');
          this.load.spritesheet('avatar', '/assets/sprites/avatar-run.png', { frameWidth: 48, frameHeight: 48 });
          this.load.spritesheet('boss', '/assets/sprites/boss-suit.png', { frameWidth: 48, frameHeight: 48 });
          this.load.image('coin', '/assets/sprites/coin.png');
          this.load.image('cash', '/assets/sprites/cash.png');
          this.load.bitmapFont('arcade', '/assets/fonts/arcade.png', '/assets/fonts/arcade.fnt');
        }
        create() {
          console.log('BootScene.create() - skipping TitleScene and starting GameScene');
          this.scene.start('GameScene');
        }
      }

      // TitleScene: for reference if needed
      class TitleScene extends Phaser.Scene {
        constructor() { super({ key: 'TitleScene' }); }
        create() {
          console.log('📢 TitleScene.create()');
          const { width, height } = this.scale;
          const highScore = localStorage.getItem('corporateChaseHighScore') || 0;
          this.add.bitmapText(width/2, height/3, 'arcade', 'Corporate Chase', 48).setOrigin(0.5);
          this.add.bitmapText(width/2, height/2, 'arcade', `High Score: $${highScore}`, 24).setOrigin(0.5);
          this.add.bitmapText(width/2, height*0.7, 'arcade', 'Press SPACE to Start', 24).setOrigin(0.5);
          this.startKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }
        update() {
          if (Phaser.Input.Keyboard.JustDown(this.startKey)) {
            console.log('SPACE pressed in TitleScene');
            this.cameras.main.fadeOut(500);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
          }
        }
      }

      // GameScene: main gameplay
      class GameScene extends Phaser.Scene {
        constructor() {
          super({ key: 'GameScene' });
          this.level = 1;
          this.score = 0;
          this.maxLevels = 10;
          this.pelletsBase = 100;
          this.bossBaseSpeed = 100;
        }
        create() {
          console.log('🚀 GameScene.create()');
          // background
          const size = 32, cols = 25, rows = 19;
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              this.add.image(x*size, y*size, 'office').setOrigin(0);
            }
          }
          // animations
          this.anims.create({ key: 'run', frames: this.anims.generateFrameNumbers('avatar', { start: 0, end: 7 }), frameRate: 12, repeat: -1 });
          this.anims.create({ key: 'boss-walk', frames: this.anims.generateFrameNumbers('boss', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
          // player
          this.player = this.physics.add.sprite(48,48,'avatar').play('run').setCollideWorldBounds(true);
          // pellets and bosses
          this.createPellets();
          this.createBossGroup();
          // UI and input
          this.createUI();
          this.cursors = this.input.keyboard.createCursorKeys();
        }
        createPellets() {
          const count = this.pelletsBase + (this.level - 1) * 15;
          if (this.pellets) this.pellets.clear(true);
          this.pellets = this.physics.add.group();
          for (let i = 0; i < count; i++) {
            const x = Phaser.Math.Between(32, 768);
            const y = Phaser.Math.Between(32, 576);
            const key = Phaser.Math.Between(0, 1) ? 'coin' : 'cash';
            this.pellets.create(x, y, key).setScale(0.8);
          }
          this.physics.add.overlap(this.player, this.pellets, (p, pellet) => {
            pellet.destroy();
            this.score += pellet.texture.key === 'coin' ? 5 : 20;
            this.scoreText.setText(`$${this.score}`);
            if (this.pellets.countActive(true) === 0) this.nextLevel();
          });
        }
        createBossGroup() {
          if (this.bosses) this.bosses.clear(true);
          this.bosses = this.physics.add.group();
          const count = Math.min(1 + Math.floor(this.level / 2), 5);
          for (let i = 0; i < count; i++) {
            const x = Phaser.Math.Between(100, 700);
            const y = Phaser.Math.Between(100, 500);
            this.bosses.create(x, y, 'boss').play('boss-walk').setCollideWorldBounds(true);
          }
          this.physics.add.collider(this.player, this.bosses, () => this.gameOver(), null, this);
        }
        createUI() {
          this.levelText?.destroy();
          this.scoreText?.destroy();
          this.levelText = this.add.bitmapText(16, 16, 'arcade', `Level ${this.level}`, 24);
          this.scoreText = this.add.bitmapText(180, 16, 'arcade', `$${this.score}`, 24);
        }
        nextLevel() {
          if (this.level >= this.maxLevels) {
            return this.scene.start('EndScene', { score: this.score, won: true });
          }
          this.level++;
          this.cameras.main.flash(300);
          this.player.setPosition(48, 48);
          this.createPellets(); this.createBossGroup(); this.createUI();
        }
        gameOver() {
          this.scene.start('EndScene', { score: this.score, won: false });
        }
        update() {
          if (!this.cursors) return;
          this.player.setVelocity(0);
          const s = 200;
          if (this.cursors.left.isDown) this.player.setVelocityX(-s);
          if (this.cursors.right.isDown) this.player.setVelocityX(s);
          if (this.cursors.up.isDown) this.player.setVelocityY(-s);
          if (this.cursors.down.isDown) this.player.setVelocityY(s);
          const bs = this.bossBaseSpeed + (this.level - 1) * 15;
          this.bosses.children.iterate(b => this.physics.moveToObject(b, this.player, bs));
        }
      }

      class EndScene extends Phaser.Scene {
        init(data) { this.score = data.score; this.won = data.won; }
        create() {
          const { width, height } = this.scale;
          const prev = localStorage.getItem('corporateChaseHighScore') || 0;
          const high = Math.max(prev, this.score);
          localStorage.setItem('corporateChaseHighScore', high);
          const title = this.won ? 'You Win!' : 'Game Over';
          this.add.bitmapText(width/2, height/3, 'arcade', title, 48).setOrigin(0.5);
          this.add.bitmapText(width/2, height/2, 'arcade', `Score: $${this.score}`, 24).setOrigin(0.5);
          this.add.bitmapText(width/2, height*0.6, 'arcade', `High Score: $${high}`, 24).setOrigin(0.5);
          this.add.bitmapText(width/2, height*0.8, 'arcade', 'Press SPACE to Restart', 24).setOrigin(0.5);
          this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }
        update() {
          if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
            console.log('SPACE pressed in EndScene');
            this.scene.start('TitleScene');
          }
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 800,
        height: 608,
        physics: { default: 'arcade', arcade: { debug: false } },
        scene: [BootScene, TitleScene, GameScene, EndScene],
        parent: 'game-canvas'
      });
      console.log('🎮 Game instantiated, canvas is:', game.canvas);
      gameRef.current = game;
    })();

    return () => gameRef.current?.destroy(true);
  }, []);

  return (
    <div className="tool-container max-w-4xl mx-auto p-6 bg-black border border-gray-700 rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold mb-4 text-green-400">Corporate Chase</h2>
      <p className="text-gray-300 mb-6">An arcade-style dash through the office maze. Collect coins & cash, outsmart the suits, and set a new high score!</p>
      <div id="game-canvas" className="w-full h-[608px]" />
    </div>
  );
}