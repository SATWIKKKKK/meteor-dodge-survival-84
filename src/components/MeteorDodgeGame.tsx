import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { StarField } from "@/components/StarField";
import { Rocket, Play, RotateCcw } from "lucide-react";

type GameState = "start" | "playing" | "gameover";

interface Meteor {
  x: number;
  y: number;
  radius: number;
  speed: number;
}

interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 50;
const PLAYER_SPEED = 8;
const INITIAL_METEOR_SPEED = 3;
const SPEED_INCREMENT = 0.0005;
const SPAWN_RATE_INITIAL = 60;
const SPAWN_RATE_MIN = 20;

export const MeteorDodgeGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>("start");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem("meteorDodgeHighScore");
    return saved ? parseInt(saved) : 0;
  });

  const gameDataRef = useRef({
    player: { x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, y: CANVAS_HEIGHT - 80, width: PLAYER_WIDTH, height: PLAYER_HEIGHT },
    meteors: [] as Meteor[],
    keys: { left: false, right: false, up: false, down: false },
    score: 0,
    frameCount: 0,
    meteorSpeed: INITIAL_METEOR_SPEED,
    spawnRate: SPAWN_RATE_INITIAL,
    animationId: 0,
  });

  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D, player: Player) => {
    ctx.save();
    
    // Ship body glow
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 20;
    
    // Main ship body
    ctx.fillStyle = "#00e5ff";
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.lineTo(player.x + player.width / 2, player.y + player.height - 10);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = "#001a33";
    ctx.beginPath();
    ctx.ellipse(
      player.x + player.width / 2,
      player.y + player.height / 2,
      8,
      12,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Engine flames
    ctx.shadowColor = "#ff6600";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#ff9933";
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2 - 8, player.y + player.height);
    ctx.lineTo(player.x + player.width / 2, player.y + player.height + 15 + Math.random() * 5);
    ctx.lineTo(player.x + player.width / 2 + 8, player.y + player.height);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, []);

  const drawMeteor = useCallback((ctx: CanvasRenderingContext2D, meteor: Meteor) => {
    ctx.save();
    
    ctx.shadowColor = "#ff4400";
    ctx.shadowBlur = 15;
    
    // Main meteor body
    const gradient = ctx.createRadialGradient(
      meteor.x, meteor.y, 0,
      meteor.x, meteor.y, meteor.radius
    );
    gradient.addColorStop(0, "#ff6644");
    gradient.addColorStop(0.5, "#cc3300");
    gradient.addColorStop(1, "#661100");
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(meteor.x, meteor.y, meteor.radius, 0, Math.PI * 2);
    ctx.fill();

    // Crater details
    ctx.fillStyle = "#441100";
    ctx.beginPath();
    ctx.arc(meteor.x - meteor.radius * 0.3, meteor.y - meteor.radius * 0.2, meteor.radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(meteor.x + meteor.radius * 0.2, meteor.y + meteor.radius * 0.3, meteor.radius * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  const checkCollision = useCallback((player: Player, meteor: Meteor): boolean => {
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    
    const dx = playerCenterX - meteor.x;
    const dy = playerCenterY - meteor.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < meteor.radius + Math.min(player.width, player.height) / 2 - 5;
  }, []);

  const spawnMeteor = useCallback(() => {
    const radius = 15 + Math.random() * 20;
    return {
      x: Math.random() * (CANVAS_WIDTH - radius * 2) + radius,
      y: -radius,
      radius,
      speed: gameDataRef.current.meteorSpeed + Math.random() * 2,
    };
  }, []);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const data = gameDataRef.current;

    // Clear canvas
    ctx.fillStyle = "rgba(5, 10, 20, 0.3)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Update player position
    if (data.keys.left && data.player.x > 0) {
      data.player.x -= PLAYER_SPEED;
    }
    if (data.keys.right && data.player.x < CANVAS_WIDTH - data.player.width) {
      data.player.x += PLAYER_SPEED;
    }
    if (data.keys.up && data.player.y > 0) {
      data.player.y -= PLAYER_SPEED;
    }
    if (data.keys.down && data.player.y < CANVAS_HEIGHT - data.player.height) {
      data.player.y += PLAYER_SPEED;
    }

    // Spawn meteors
    data.frameCount++;
    if (data.frameCount % Math.floor(data.spawnRate) === 0) {
      data.meteors.push(spawnMeteor());
    }

    // Increase difficulty
    data.meteorSpeed += SPEED_INCREMENT;
    if (data.spawnRate > SPAWN_RATE_MIN) {
      data.spawnRate -= 0.01;
    }

    // Update and draw meteors
    data.meteors = data.meteors.filter((meteor) => {
      meteor.y += meteor.speed;

      // Check collision
      if (checkCollision(data.player, meteor)) {
        // Game over
        const finalScore = Math.floor(data.score);
        if (finalScore > highScore) {
          setHighScore(finalScore);
          localStorage.setItem("meteorDodgeHighScore", finalScore.toString());
        }
        setScore(finalScore);
        setGameState("gameover");
        cancelAnimationFrame(data.animationId);
        return false;
      }

      if (meteor.y > CANVAS_HEIGHT + meteor.radius) {
        return false;
      }

      drawMeteor(ctx, meteor);
      return true;
    });

    // Draw player
    drawPlayer(ctx, data.player);

    // Update score
    data.score += 0.1;
    setScore(Math.floor(data.score));

    data.animationId = requestAnimationFrame(gameLoop);
  }, [checkCollision, drawMeteor, drawPlayer, highScore, spawnMeteor]);

  const startGame = useCallback(() => {
    const data = gameDataRef.current;
    data.player = { x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, y: CANVAS_HEIGHT - 80, width: PLAYER_WIDTH, height: PLAYER_HEIGHT };
    data.meteors = [];
    data.score = 0;
    data.frameCount = 0;
    data.meteorSpeed = INITIAL_METEOR_SPEED;
    data.spawnRate = SPAWN_RATE_INITIAL;
    
    setScore(0);
    setGameState("playing");

    // Focus the container to capture keyboard events
    containerRef.current?.focus();

    // Clear canvas
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#050a14";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    gameLoop();
  }, [gameLoop]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(gameDataRef.current.animationId);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className="relative flex flex-col items-center justify-center min-h-screen p-4 outline-none"
      onKeyDown={(e) => {
        if (gameState !== "playing") return;
        const data = gameDataRef.current;
        if (e.key === "ArrowLeft" || e.key === "a") data.keys.left = true;
        if (e.key === "ArrowRight" || e.key === "d") data.keys.right = true;
        if (e.key === "ArrowUp" || e.key === "w") data.keys.up = true;
        if (e.key === "ArrowDown" || e.key === "s") data.keys.down = true;
        e.preventDefault();
      }}
      onKeyUp={(e) => {
        const data = gameDataRef.current;
        if (e.key === "ArrowLeft" || e.key === "a") data.keys.left = false;
        if (e.key === "ArrowRight" || e.key === "d") data.keys.right = false;
        if (e.key === "ArrowUp" || e.key === "w") data.keys.up = false;
        if (e.key === "ArrowDown" || e.key === "s") data.keys.down = false;
      }}
    >
      <StarField />
      
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Score display during gameplay */}
        {gameState === "playing" && (
          <div className="score-display">
            SCORE: {score}
          </div>
        )}

        {/* Canvas container */}
        <div className="relative neon-border rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block max-w-full h-auto"
            style={{ background: "#050a14" }}
          />

          {/* Start Screen Overlay */}
          {gameState === "start" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="animate-float mb-8">
                <Rocket className="w-20 h-20 text-primary" style={{ filter: "drop-shadow(0 0 20px hsl(186 100% 50% / 0.6))" }} />
              </div>
              <h1 className="game-title mb-2">METEOR</h1>
              <h1 className="game-title mb-6">DODGE</h1>
              <p className="game-subtitle mb-8">Survive the asteroid field</p>
              
              <Button variant="game" size="xl" onClick={startGame}>
                <Play className="w-6 h-6 mr-2" />
                PLAY
              </Button>

              <div className="mt-8 text-center">
                <p className="text-muted-foreground font-body text-sm">
                  Use <span className="text-primary">Arrow Keys</span> or <span className="text-primary">WASD</span> to move
                </p>
                {highScore > 0 && (
                  <p className="text-muted-foreground font-body text-sm mt-2">
                    High Score: <span className="text-primary">{highScore}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameState === "gameover" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
              <h2 className="game-over-title mb-6">GAME OVER</h2>
              
              <p className="game-subtitle mb-2">Final Score</p>
              <p className="final-score mb-2">{score}</p>
              
              {score >= highScore && score > 0 && (
                <p className="text-accent font-display text-lg tracking-wider mb-6 animate-pulse">
                  NEW HIGH SCORE!
                </p>
              )}
              
              {score < highScore && (
                <p className="text-muted-foreground font-body mb-6">
                  High Score: <span className="text-primary">{highScore}</span>
                </p>
              )}

              <div className="flex gap-4">
                <Button variant="game" size="xl" onClick={startGame}>
                  <RotateCcw className="w-5 h-5 mr-2" />
                  PLAY AGAIN
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Controls hint */}
        {gameState === "playing" && (
          <p className="text-muted-foreground/60 font-body text-sm">
            Arrow Keys or WASD to move
          </p>
        )}
      </div>
    </div>
  );
};
