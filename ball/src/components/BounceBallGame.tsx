import { useState, useRef, useEffect } from 'react'
import './BounceBallGame.css'
import defaultBallImage from '../assets/IMG_5412.png'

interface Player {
  x: number
  y: number
  radius: number
  image: HTMLImageElement | null
  rotation: number // 회전 각도 (라디안)
  vy: number // 수직 속도
  groundY: number // 바닥 Y 위치
  isJumping: boolean // 점프 중인지 여부
}

interface Obstacle {
  x: number
  y: number
  width: number
  height: number
  speed: number
}

// 기본 이미지 로드 함수
const loadDefaultImage = (): HTMLImageElement => {
  const img = new Image()
  img.src = defaultBallImage
  return img
}

const BounceBallGame = () => {
  const [ballImage, setBallImage] = useState<HTMLImageElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({})
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const playerRef = useRef<Player | null>(null)
  const obstaclesRef = useRef<Obstacle[]>([])
  const lastObstacleTimeRef = useRef<number>(0)

  // 기본 이미지 초기화
  useEffect(() => {
    const defaultImg = loadDefaultImage()
    defaultImg.onload = () => {
      setBallImage(defaultImg)
    }
    // 이미 로드된 경우를 대비
    if (defaultImg.complete) {
      setBallImage(defaultImg)
    }
  }, [])

  const PLAYER_RADIUS = 40
  const PLAYER_SPEED = 5
  const ROTATION_SPEED = PLAYER_SPEED / PLAYER_RADIUS // 이동 거리에 비례한 회전 속도
  const JUMP_SPEED = -15 // 점프 속도 (음수 = 위로)
  const GRAVITY = 0.8 // 중력
  const OBSTACLE_BASE_SPAWN_INTERVAL = 800 // 밀리초 (더 자주 생성)
  const OBSTACLE_MIN_SPAWN_INTERVAL = 300 // 최소 생성 간격
  const OBSTACLE_MIN_WIDTH = 60
  const OBSTACLE_MAX_WIDTH = 120
  const OBSTACLE_HEIGHT = 60
  const OBSTACLE_BASE_SPEED = 5 // 기본 속도 증가
  const OBSTACLE_SPEED_INCREASE = 0.2 // 속도 증가율 증가

  // 키보드 입력 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A') {
        setKeys(prev => ({ ...prev, a: true }))
      }
      if (e.key === 'd' || e.key === 'D') {
        setKeys(prev => ({ ...prev, d: true }))
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault() // 스크롤 방지
        setKeys(prev => ({ ...prev, space: true }))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A') {
        setKeys(prev => ({ ...prev, a: false }))
      }
      if (e.key === 'd' || e.key === 'D') {
        setKeys(prev => ({ ...prev, d: false }))
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        setKeys(prev => ({ ...prev, space: false }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // 게임 루프
  useEffect(() => {
    if (isPlaying && !gameOver && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx || !playerRef.current) return

      const animate = () => {
        if (!playerRef.current || !ctx || gameOver) return

        const player = playerRef.current
        const width = canvas.width
        const height = canvas.height
        const currentTime = Date.now()

        // 플레이어 이동 (a/d 키) 및 회전
        if (keys.a && player.x - player.radius > 0) {
          player.x -= PLAYER_SPEED
          player.rotation -= ROTATION_SPEED // 왼쪽 이동 시 반시계 방향 회전
        }
        if (keys.d && player.x + player.radius < width) {
          player.x += PLAYER_SPEED
          player.rotation += ROTATION_SPEED // 오른쪽 이동 시 시계 방향 회전
        }

        // 점프 (스페이스바) - 바닥에 있을 때만
        if (keys.space && !player.isJumping && Math.abs(player.y - player.groundY) < 1) {
          player.vy = JUMP_SPEED
          player.isJumping = true
        }

        // 중력 적용
        player.vy += GRAVITY
        player.y += player.vy

        // 바닥 충돌 감지
        if (player.y >= player.groundY) {
          player.y = player.groundY
          player.vy = 0
          player.isJumping = false
        }

        // 천장 충돌 감지 (플레이어가 화면 위로 나가지 않도록)
        if (player.y - player.radius < 0) {
          player.y = player.radius
          player.vy = 0
        }

        // 장애물 생성 (난이도에 따라 간격과 개수 조절)
        const difficultyLevel = Math.floor(score / 8) // 8점마다 난이도 증가 (더 빠른 증가)
        const spawnInterval = Math.max(
          OBSTACLE_MIN_SPAWN_INTERVAL,
          OBSTACLE_BASE_SPAWN_INTERVAL - (difficultyLevel * 80) // 더 빠르게 간격 감소
        )
        const obstacleCount = 1 + Math.floor(difficultyLevel / 2) // 2레벨마다 장애물 1개씩 증가 (최대 5개)
        
        if (currentTime - lastObstacleTimeRef.current > spawnInterval) {
          const speed = OBSTACLE_BASE_SPEED + (score * OBSTACLE_SPEED_INCREASE)
          
          // 여러 개의 장애물 생성
          for (let i = 0; i < Math.min(obstacleCount, 5); i++) {
            const obstacleWidth = Math.random() * (OBSTACLE_MAX_WIDTH - OBSTACLE_MIN_WIDTH) + OBSTACLE_MIN_WIDTH
            const obstacleX = Math.random() * (width - obstacleWidth)
            
            obstaclesRef.current.push({
              x: obstacleX,
              y: -OBSTACLE_HEIGHT - (i * OBSTACLE_HEIGHT * 0.5), // 약간씩 간격을 두고 생성
              width: obstacleWidth,
              height: OBSTACLE_HEIGHT,
              speed: speed,
            })
          }
          lastObstacleTimeRef.current = currentTime
        }

        // 장애물 이동 및 제거
        obstaclesRef.current = obstaclesRef.current.filter(obstacle => {
          obstacle.y += obstacle.speed

          // 충돌 감지
          const playerLeft = player.x - player.radius
          const playerRight = player.x + player.radius
          const playerTop = player.y - player.radius
          const playerBottom = player.y + player.radius

          const obstacleLeft = obstacle.x
          const obstacleRight = obstacle.x + obstacle.width
          const obstacleTop = obstacle.y
          const obstacleBottom = obstacle.y + obstacle.height

          if (
            playerRight > obstacleLeft &&
            playerLeft < obstacleRight &&
            playerBottom > obstacleTop &&
            playerTop < obstacleBottom
          ) {
            // 충돌 발생
            setGameOver(true)
            setIsPlaying(false)
            return false
          }

          // 화면 밖으로 나간 장애물 제거 및 점수 증가
          if (obstacle.y > height) {
            setScore(prev => prev + 1)
            return false
          }

          return true
        })

        // 화면 지우기
        ctx.clearRect(0, 0, width, height)

        // 배경 그리기 (선택사항)
        ctx.fillStyle = '#f0f0f0'
        ctx.fillRect(0, 0, width, height)

        // 장애물 그리기
        obstaclesRef.current.forEach(obstacle => {
          ctx.fillStyle = '#e74c3c'
          ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
          ctx.strokeStyle = '#c0392b'
          ctx.lineWidth = 2
          ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
        })

        // 플레이어 그리기 (회전 적용)
        if (player.image) {
          ctx.save()
          // 회전 중심을 플레이어 위치로 이동
          ctx.translate(player.x, player.y)
          // 회전 적용
          ctx.rotate(player.rotation)
          // 원형 클리핑
          ctx.beginPath()
          ctx.arc(0, 0, player.radius, 0, Math.PI * 2)
          ctx.clip()
          // 이미지 그리기 (중심 기준)
          ctx.drawImage(
            player.image,
            -player.radius,
            -player.radius,
            player.radius * 2,
            player.radius * 2
          )
          ctx.restore()
        } else {
          ctx.fillStyle = '#4CAF50'
          ctx.beginPath()
          ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#2e7d32'
          ctx.lineWidth = 3
          ctx.stroke()
        }

        animationFrameRef.current = requestAnimationFrame(animate)
      }

      animate()
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, gameOver, keys, score])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  const startGame = () => {
    if (!canvasRef.current || !ballImage) return

    const canvas = canvasRef.current
    const groundY = canvas.height - 60
    const player: Player = {
      x: canvas.width / 2,
      y: groundY,
      radius: PLAYER_RADIUS,
      image: ballImage,
      rotation: 0, // 초기 회전 각도
      vy: 0, // 초기 수직 속도
      groundY: groundY, // 바닥 Y 위치
      isJumping: false, // 초기 점프 상태
    }

    playerRef.current = player
    obstaclesRef.current = []
    lastObstacleTimeRef.current = Date.now()
    setScore(0)
    setGameOver(false)
    setIsPlaying(true)
  }

  const stopGame = () => {
    setIsPlaying(false)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }

  const resetGame = () => {
    // 게임 정지
    setIsPlaying(false)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    // 상태 초기화
    setGameOver(false)
    setScore(0)
    obstaclesRef.current = []
    lastObstacleTimeRef.current = Date.now()
    
    // 플레이어 초기화
    if (canvasRef.current) {
      const canvas = canvasRef.current
      const groundY = canvas.height - 60
      
      if (playerRef.current) {
        playerRef.current.x = canvas.width / 2
        playerRef.current.y = groundY
        playerRef.current.groundY = groundY
        playerRef.current.rotation = 0 // 회전 각도 리셋
        playerRef.current.vy = 0 // 수직 속도 리셋
        playerRef.current.isJumping = false // 점프 상태 리셋
      } else if (ballImage) {
        // 플레이어가 없으면 새로 생성
        playerRef.current = {
          x: canvas.width / 2,
          y: groundY,
          radius: PLAYER_RADIUS,
          image: ballImage,
          rotation: 0,
          vy: 0,
          groundY: groundY,
          isJumping: false,
        }
      }
    }
  }

  return (
    <div className="bounce-ball-game">
      <div className="game-controls">
        <h1>장애물 회피 게임</h1>
        <div className="score-board">
          <div className="score">점수: {score}</div>
          {gameOver && <div className="game-over">게임 오버!</div>}
        </div>
        <div className="controls">
          <button onClick={startGame} disabled={isPlaying && !gameOver}>
            {gameOver ? '다시 시작' : '시작'}
          </button>
          <button onClick={stopGame} disabled={!isPlaying || gameOver}>
            정지
          </button>
          <button onClick={resetGame}>
            리셋
          </button>
        </div>
        {isPlaying && !gameOver && (
          <p className="hint">⌨️ A키: 왼쪽 이동 | D키: 오른쪽 이동 | 스페이스바: 점프</p>
        )}
      </div>
      <canvas 
        ref={canvasRef} 
        className="game-canvas"
        tabIndex={0}
      />
    </div>
  )
}

export default BounceBallGame
