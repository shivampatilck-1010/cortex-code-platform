with open("src/app/classroom/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

dup = """function MovingDotsBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-black z-0">
      <style dangerouslySetInnerHTML={{__html: `
        .moving-dots-bg {
          position: absolute;
          inset: -50%;
          width: 200%;
          height: 200%;
          background-image: radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px);
          background-size: 30px 30px;
          animation: panDots 4s linear infinite;
        }
        @keyframes panDots {
          0% { transform: translate(0, 0); }
          100% { transform: translate(-30px, -30px); }
        }
      `}} />
      <div className="moving-dots-bg"></div>
    </div>
  );
}

function MovingDotsBackground() {"""

fix = """function MovingDotsBackground() {"""

content = content.replace(dup, fix)

with open("src/app/classroom/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
