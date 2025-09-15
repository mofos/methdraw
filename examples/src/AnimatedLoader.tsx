import React from 'react'

interface AnimatedLoaderProps {
  size?: string | number
}

export function AnimatedLoader({ size = '10.5em' }: AnimatedLoaderProps) {
  // Inline styles for the animation
  const loaderStyles: React.CSSProperties = {
    width: typeof size === 'number' ? `${size}px` : size,
    height: typeof size === 'number' ? `${size}px` : size,
    position: 'relative',
    margin: 'auto',
    display: 'block',
  }

  const dotColors = [
    'hsl(3,90%,55%)',
    'hsl(113,90%,55%)',
    'hsl(223,90%,55%)',
  ]

  const spinKeyframes = `@keyframes spin { from { transform: rotate(120deg); } 33.33% { transform: rotate(130deg); } 66.67% { transform: rotate(255deg); } to { transform: rotate(240deg); } }`

  const styleSheet = `
.pl { animation: spin 2s cubic-bezier(0.65,0,0.35,1) infinite; }
.pl__dot, .pl__dot-layer { position: absolute; }
.pl__dot { width: 1.75em; height: 1.75em; top: 50%; left: 50%; transform: translate(-50%, -50%); }
.pl__dot-layer { width: 100%; height: 100%; border-radius: 50%; mix-blend-mode: screen; }
.pl__dot-layer:nth-child(1) { background: hsl(3,90%,55%); animation: scale-down-1 2s cubic-bezier(0.85,0,0.15,1) infinite; }
.pl__dot-layer:nth-child(2) { background: hsl(113,90%,55%); animation: scale-down-2 2s cubic-bezier(0.85,0,0.15,1) infinite; transform: translate(0,20%) scale(0.85); }
.pl__dot-layer:nth-child(3) { background: hsl(223,90%,55%); animation: scale-down-3 2s cubic-bezier(0.85,0,0.15,1) infinite; transform: translate(0,40%) scale(0.7); }
@keyframes scale-down-1 { from,90%,to{transform:translate(0,0) scale(1);} 30%{transform:translate(0,-45%) scale(0.57);} 40%{transform:translate(10%,-45%) scale(0.57);} 50%{transform:translate(-10%,-45%) scale(0.57);} 60%{transform:translate(0,-45%) scale(0.57);} }
@keyframes scale-down-2 { from,90%,to{transform:translate(0,20%) scale(0.85);} 30%,60%{transform:translate(0,-45%) scale(0.57);} }
@keyframes scale-down-3 { from,90%,to{transform:translate(0,40%) scale(0.7);} 30%{transform:translate(0,-45%) scale(0.57);} 40%{transform:translate(-10%,-45%) scale(0.57);} 50%{transform:translate(10%,-45%) scale(0.57);} 60%{transform:translate(0,-45%) scale(0.57);} }
`;

  React.useEffect(() => {
    // Inject the keyframes and styles once
    if (!document.getElementById('animated-loader-styles')) {
      const style = document.createElement('style')
      style.id = 'animated-loader-styles'
      style.innerHTML = spinKeyframes + styleSheet
      document.head.appendChild(style)
    }
  }, [])

  // 6 dots, each with 3 layers
  const dots = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * 60) // 360/6
    const even = i % 2 === 1
    const sizeEm = even ? 2.25 : 1.75
    const offset = even ? -1.125 : -0.875
    return (
      <div
        className="pl__dot"
        key={i}
        style={{
          width: `${sizeEm}em`,
          height: `${sizeEm}em`,
          top: `calc(50% + ${offset}em)`,
          left: `calc(50% + ${offset}em)`,
          transform: `rotate(${angle}deg) translate(0, -4em)`
        }}
      >
        {[0, 1, 2].map((j) => (
          <div className="pl__dot-layer" key={j} />
        ))}
      </div>
    )
  })

  return <div className="pl" style={loaderStyles}>{dots}</div>
} 