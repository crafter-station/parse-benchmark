"use client";

import { useEffect, useRef } from "react";

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    let rotation = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    interface Particle {
      angle: number;
      radius: number;
      size: number;
      speed: number;
      opacity: number;
    }

    const initParticles = () => {
      particles = [];
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.max(centerX, centerY) * 1.5;
      const particleCount = Math.floor((canvas.width * canvas.height) / 800);

      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.pow(Math.random(), 0.5) * maxRadius;
        
        // Create density rings
        const ringFactor = Math.sin(radius * 0.02) * 0.5 + 0.5;
        
        particles.push({
          angle,
          radius,
          size: Math.random() * 1.5 + 0.5,
          speed: (0.00002 + Math.random() * 0.00006) * (1 - radius / maxRadius),
          opacity: (0.3 + Math.random() * 0.7) * ringFactor,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      rotation += 0.00004;

      particles.forEach((p) => {
        p.angle += p.speed;
        
        const x = centerX + Math.cos(p.angle + rotation) * p.radius;
        const y = centerY + Math.sin(p.angle + rotation) * p.radius;

        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 245, 245, ${p.opacity})`;
        ctx.fill();
      });

      animationId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      aria-hidden="true"
    />
  );
}
