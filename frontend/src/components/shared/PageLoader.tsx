const CSS = `
  @keyframes elo-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes elo-glow {
    0%, 100% { opacity: 0.18; transform: scale(0.85); }
    50%       { opacity: 0.55; transform: scale(1.15); }
  }
  @keyframes elo-fadein {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes elo-dot {
    0%, 100% { transform: scale(0.3); opacity: 0.15; }
    50%       { transform: scale(1);   opacity: 1;    }
  }
  @keyframes elo-center-pulse {
    0%, 100% { box-shadow: 0 0 8px 2px rgba(7,188,52,0.5); }
    50%       { box-shadow: 0 0 18px 6px rgba(7,188,52,0.9); }
  }
`

export function PageLoader() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div style={{
        position: 'fixed', inset: 0,
        background: '#0c100e',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}>

        {/* Radial background glow */}
        <div style={{
          position: 'absolute',
          width: 320, height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(7,188,52,0.14) 0%, transparent 70%)',
          animation: 'elo-glow 2.8s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* Rings */}
        <div style={{ position: 'relative', width: 112, height: 112 }}>

          {/* Ring 1 — plano horizontal, gira rápido */}
          <div style={{
            position: 'absolute', inset: 0,
            animation: 'elo-spin 1.7s linear infinite',
          }}>
            <svg viewBox="0 0 112 112" width="112" height="112">
              <circle cx="56" cy="56" r="47"
                fill="none" stroke="#07bc34" strokeWidth="5.5"
                strokeLinecap="round" strokeDasharray="200 96"
                style={{ filter: 'drop-shadow(0 0 7px rgba(7,188,52,0.9))' }}
              />
            </svg>
          </div>

          {/* Ring 2 — inclinado en X, gira medio inverso */}
          <div style={{ position: 'absolute', inset: 0, transform: 'rotateX(66deg)' }}>
            <div style={{ width: '100%', height: '100%', animation: 'elo-spin 2.5s linear infinite reverse' }}>
              <svg viewBox="0 0 112 112" width="112" height="112">
                <circle cx="56" cy="56" r="47"
                  fill="none" stroke="#07bc34" strokeWidth="4.5"
                  strokeLinecap="round" strokeDasharray="135 225"
                  opacity="0.65"
                  style={{ filter: 'drop-shadow(0 0 5px rgba(7,188,52,0.65))' }}
                />
              </svg>
            </div>
          </div>

          {/* Ring 3 — inclinado en Y, gira lento */}
          <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(66deg)' }}>
            <div style={{ width: '100%', height: '100%', animation: 'elo-spin 3.4s linear infinite' }}>
              <svg viewBox="0 0 112 112" width="112" height="112">
                <circle cx="56" cy="56" r="47"
                  fill="none" stroke="#07bc34" strokeWidth="3.5"
                  strokeLinecap="round" strokeDasharray="80 280"
                  opacity="0.38"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(7,188,52,0.5))' }}
                />
              </svg>
            </div>
          </div>

          {/* Centro */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 10, height: 10,
            borderRadius: '50%',
            background: '#07bc34',
            animation: 'elo-center-pulse 1.7s ease-in-out infinite',
          }} />
        </div>

        {/* Marca */}
        <div style={{
          marginTop: 30,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          animation: 'elo-fadein 0.6s ease forwards',
          animationDelay: '0.25s',
          opacity: 0,
        }}>
          <p style={{
            color: 'white',
            fontWeight: 800,
            fontSize: 21,
            letterSpacing: 6,
            fontFamily: 'Inter, sans-serif',
            margin: 0,
          }}>
            Elo<span style={{ color: '#07bc34' }}>SC</span>
          </p>

          {/* Dots */}
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display: 'inline-block',
                width: 5, height: 5,
                borderRadius: '50%',
                background: '#07bc34',
                animation: 'elo-dot 1.3s ease-in-out infinite',
                animationDelay: `${i * 0.22}s`,
              }} />
            ))}
          </div>
        </div>

      </div>
    </>
  )
}
