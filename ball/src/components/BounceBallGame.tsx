import { useState, useRef, useEffect } from 'react'
import './BounceBallGame.css'
import defaultBallImage from '../assets/default-ball.svg'

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
  image: HTMLImageElement | null
}

// 기본 이미지 로드 함수
const loadDefaultImage = (): HTMLImageElement => {
  const img = new Image()
  img.src = defaultBallImage
  return img
}

// 아이콘 이미지들을 동적으로 가져오기
const iconModules = import.meta.glob('../assets/icon/*.svg', { eager: true })
const iconPaths = Object.values(iconModules).map((module: any) => module.default) as string[]

// 아이콘 이미지 로드 함수
const loadIconImage = (iconPath: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = iconPath
  })
}

type GameMode = 'normal' | 'hard'

// 랭킹 저장/로드 함수 (모드별로 분리)
const saveScore = (score: number, mode: GameMode) => {
  const key = mode === 'hard' ? 'bounceBallGameScoresHard' : 'bounceBallGameScores'
  const scores = getScores(mode)
  scores.push({ score, date: new Date().toISOString() })
  scores.sort((a, b) => b.score - a.score) // 내림차순 정렬
  const topScores = scores.slice(0, 10) // 상위 10개만 저장
  localStorage.setItem(key, JSON.stringify(topScores))
}

const getScores = (mode: GameMode): Array<{ score: number; date: string }> => {
  const key = mode === 'hard' ? 'bounceBallGameScoresHard' : 'bounceBallGameScores'
  const saved = localStorage.getItem(key)
  return saved ? JSON.parse(saved) : []
}

const BounceBallGame = () => {
  const [ballImage, setBallImage] = useState<HTMLImageElement | null>(null)
  const [obstacleImages, setObstacleImages] = useState<HTMLImageElement[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [showRanking, setShowRanking] = useState(false)
  const [gameMode, setGameMode] = useState<GameMode>('normal')
  const [selectedRankingMode, setSelectedRankingMode] = useState<GameMode>('normal')
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({})
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const playerRef = useRef<Player | null>(null)
  const obstaclesRef = useRef<Obstacle[]>([])
  const lastObstacleTimeRef = useRef<number>(0)
  const scoreSavedRef = useRef<boolean>(false)
  const gameStartTimeRef = useRef<number>(0)

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

  // 아이콘 이미지들 초기화
  useEffect(() => {
    const loadAllIcons = async () => {
      try {
        const images = await Promise.all(
          iconPaths.map(path => loadIconImage(path))
        )
        setObstacleImages(images)
      } catch (error) {
        console.error('아이콘 이미지 로드 실패:', error)
      }
    }
    loadAllIcons()
  }, [])

  // 게임 오버 시 점수 저장
  useEffect(() => {
    if (gameOver && !scoreSavedRef.current) {
      saveScore(score, gameMode)
      scoreSavedRef.current = true
    }
  }, [gameOver, score, gameMode])

  const PLAYER_RADIUS = 40
  const PLAYER_SPEED = 5
  const PLAYER_DASH_SPEED = 10 // 대시 속도
  const ROTATION_SPEED = PLAYER_SPEED / PLAYER_RADIUS // 이동 거리에 비례한 회전 속도
  const DASH_ROTATION_SPEED = PLAYER_DASH_SPEED / PLAYER_RADIUS // 대시 시 회전 속도
  const JUMP_SPEED = -15 // 점프 속도 (음수 = 위로)
  const GRAVITY = 0.8 // 중력
  // 일반 모드 설정
  const OBSTACLE_BASE_SPAWN_INTERVAL_NORMAL = 800
  const OBSTACLE_MIN_SPAWN_INTERVAL_NORMAL = 300
  const OBSTACLE_BASE_SPEED_NORMAL = 5
  const OBSTACLE_SPEED_INCREASE_NORMAL = 0.2
  const OBSTACLE_SPEED_VARIANCE_NORMAL = 2 // 랜덤 속도 범위
  
  // 하드 모드 설정 (더 어려움)
  const OBSTACLE_BASE_SPAWN_INTERVAL_HARD = 600
  const OBSTACLE_MIN_SPAWN_INTERVAL_HARD = 200
  const OBSTACLE_BASE_SPEED_HARD = 8
  const OBSTACLE_SPEED_INCREASE_HARD = 0.3
  const OBSTACLE_SPEED_VARIANCE_HARD = 3 // 랜덤 속도 범위
  
  // 현재 모드에 따른 설정
  const OBSTACLE_BASE_SPAWN_INTERVAL = gameMode === 'hard' ? OBSTACLE_BASE_SPAWN_INTERVAL_HARD : OBSTACLE_BASE_SPAWN_INTERVAL_NORMAL
  const OBSTACLE_MIN_SPAWN_INTERVAL = gameMode === 'hard' ? OBSTACLE_MIN_SPAWN_INTERVAL_HARD : OBSTACLE_MIN_SPAWN_INTERVAL_NORMAL
  const OBSTACLE_BASE_SPEED = gameMode === 'hard' ? OBSTACLE_BASE_SPEED_HARD : OBSTACLE_BASE_SPEED_NORMAL
  const OBSTACLE_SPEED_INCREASE = gameMode === 'hard' ? OBSTACLE_SPEED_INCREASE_HARD : OBSTACLE_SPEED_INCREASE_NORMAL
  const OBSTACLE_SPEED_VARIANCE = gameMode === 'hard' ? OBSTACLE_SPEED_VARIANCE_HARD : OBSTACLE_SPEED_VARIANCE_NORMAL
  
  const OBSTACLE_WIDTH = 60 // 일정한 장애물 너비
  const OBSTACLE_HEIGHT = 60 // 일정한 장애물 높이

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
      if (e.key === 'Shift') {
        setKeys(prev => ({ ...prev, shift: true }))
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
      if (e.key === 'Shift') {
        setKeys(prev => ({ ...prev, shift: false }))
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

        // 플레이어 이동 (a/d 키) 및 회전 (쉬프트 = 대시)
        const isDashing = keys.shift
        const currentSpeed = isDashing ? PLAYER_DASH_SPEED : PLAYER_SPEED
        const currentRotationSpeed = isDashing ? DASH_ROTATION_SPEED : ROTATION_SPEED
        
        if (keys.a && player.x - player.radius > 0) {
          player.x -= currentSpeed
          player.rotation -= currentRotationSpeed // 왼쪽 이동 시 반시계 방향 회전
        }
        if (keys.d && player.x + player.radius < width) {
          player.x += currentSpeed
          player.rotation += currentRotationSpeed // 오른쪽 이동 시 시계 방향 회전
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

        // 장애물 생성 (시간에 따라 난이도 증가)
        const elapsedTime = currentTime - gameStartTimeRef.current // 경과 시간 (밀리초)
        const elapsedSeconds = elapsedTime / 1000 // 초 단위
        const difficultyLevel = Math.floor(elapsedSeconds / 5) // 5초마다 난이도 증가
        const spawnInterval = Math.max(
          OBSTACLE_MIN_SPAWN_INTERVAL,
          OBSTACLE_BASE_SPAWN_INTERVAL - (difficultyLevel * 80) // 난이도에 따라 간격 감소
        )
        const obstacleCount = 1 + Math.floor(difficultyLevel / 2) // 2레벨마다 장애물 1개씩 증가 (최대 5개)
        
        if (currentTime - lastObstacleTimeRef.current > spawnInterval) {
          const baseSpeed = OBSTACLE_BASE_SPEED + (elapsedSeconds * OBSTACLE_SPEED_INCREASE) // 시간에 따라 기본 속도 증가
          
          // 여러 개의 장애물 생성
          for (let i = 0; i < Math.min(obstacleCount, 5); i++) {
            const obstacleX = Math.random() * (width - OBSTACLE_WIDTH)
            // 랜덤 아이콘 선택
            const randomIcon = obstacleImages.length > 0 
              ? obstacleImages[Math.floor(Math.random() * obstacleImages.length)]
              : null
            // 랜덤 속도 추가 (기본 속도 + 랜덤 변동, 전체적으로는 빨라짐)
            const randomSpeedOffset = (Math.random() - 0.5) * OBSTACLE_SPEED_VARIANCE // -VARIANCE/2 ~ +VARIANCE/2
            const speed = Math.max(1, baseSpeed + randomSpeedOffset) // 최소 속도 1 보장
            
            obstaclesRef.current.push({
              x: obstacleX,
              y: -OBSTACLE_HEIGHT - (i * OBSTACLE_HEIGHT * 0.5), // 약간씩 간격을 두고 생성
              width: OBSTACLE_WIDTH,
              height: OBSTACLE_HEIGHT,
              speed: speed,
              image: randomIcon,
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
          if (obstacle.image) {
            ctx.drawImage(
              obstacle.image,
              obstacle.x,
              obstacle.y,
              obstacle.width,
              obstacle.height
            )
          } else {
            // 이미지가 없는 경우 폴백으로 빨간 박스 표시
            ctx.fillStyle = '#e74c3c'
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
            ctx.strokeStyle = '#c0392b'
            ctx.lineWidth = 2
            ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
          }
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
  }, [isPlaying, gameOver, keys, obstacleImages, gameMode])

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
    const startTime = Date.now()
    gameStartTimeRef.current = startTime
    lastObstacleTimeRef.current = startTime
    setScore(0)
    setGameOver(false)
    setIsPlaying(true)
    scoreSavedRef.current = false
    setShowRanking(false)
  }


  const restartGame = () => {
    // 상태 초기화
    setGameOver(false)
    setScore(0)
    obstaclesRef.current = []
    scoreSavedRef.current = false
    setShowRanking(false)
    // 게임 시작
    startGame()
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
    scoreSavedRef.current = false
    setShowRanking(false)
    
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
        {!isPlaying && !gameOver && (
          <div className="mode-selection">
            <label>모드 선택:</label>
            <div className="mode-buttons">
              <button 
                className={`mode-button ${gameMode === 'normal' ? 'active' : ''}`}
                onClick={() => setGameMode('normal')}
              >
                일반 모드
              </button>
              <button 
                className={`mode-button ${gameMode === 'hard' ? 'active' : ''}`}
                onClick={() => setGameMode('hard')}
              >
                하드 모드
              </button>
            </div>
          </div>
        )}
        <div className="score-board">
          <div className="score">점수: {score}</div>
          {gameMode === 'hard' && <div className="mode-badge hard">하드 모드</div>}
          {gameOver && <div className="game-over">게임 오버!</div>}
        </div>
        <div className="controls">
          <button onClick={startGame} disabled={isPlaying && !gameOver}>
            {gameOver ? '다시 시작' : '시작'}
          </button>
          <button onClick={resetGame}>
            리셋
          </button>
        </div>
        {isPlaying && !gameOver && (
          <p className="hint">⌨️ A키: 왼쪽 이동 | D키: 오른쪽 이동 | 스페이스바: 점프 | 쉬프트: 대시</p>
        )}
      </div>
      <canvas 
        ref={canvasRef} 
        className="game-canvas"
        tabIndex={0}
      />
      {gameOver && (
        <div className="game-over-modal">
          <div className="game-over-modal-content">
            <h2>나 이거 싫어요!</h2>
            <div className="final-score">최종 점수: {score}점</div>
            <div className="modal-buttons">
              <button className="modal-button restart-button" onClick={restartGame}>
                다시하기
              </button>
              <button className="modal-button ranking-button" onClick={() => setShowRanking(true)}>
                랭킹보기
              </button>
            </div>
          </div>
        </div>
      )}
      {showRanking && (
        <div className="ranking-modal">
          <div className="ranking-modal-content">
            <h2>랭킹</h2>
            <div className="ranking-tabs">
              <button 
                className={`ranking-tab ${selectedRankingMode === 'normal' ? 'active' : ''}`}
                onClick={() => setSelectedRankingMode('normal')}
              >
                일반 모드
              </button>
              <button 
                className={`ranking-tab ${selectedRankingMode === 'hard' ? 'active' : ''}`}
                onClick={() => setSelectedRankingMode('hard')}
              >
                하드 모드
              </button>
            </div>
            <div className="ranking-list">
              {getScores(selectedRankingMode).length > 0 ? (
                <ol>
                  {getScores(selectedRankingMode).map((record, index) => (
                    <li key={index}>
                      <span className="rank-number">{index + 1}위</span>
                      <span className="rank-score">{record.score}점</span>
                      <span className="rank-date">{new Date(record.date).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="no-ranking">아직 기록이 없습니다.</p>
              )}
            </div>
            <button className="modal-button close-button" onClick={() => setShowRanking(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default BounceBallGame
