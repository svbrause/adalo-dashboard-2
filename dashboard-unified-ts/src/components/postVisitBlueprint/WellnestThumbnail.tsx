import React from "react";
import {
  getWellnestThumbnailSlide,
  WELLNEST_DR_REDDY_IMAGE,
  WELLNEST_VIAL_IMAGES,
  type WellnestSlideConfig,
} from "../../config/wellnestThumbnails";

interface WellnestThumbnailProps {
  imageKey: string;
  className?: string;
  alt?: string;
  compact?: boolean;
}

function ThumbnailByConfig({
  config,
  className,
  alt = "",
  compact = false,
}: {
  config: WellnestSlideConfig;
  className?: string;
  alt?: string;
  compact?: boolean;
}) {
  const mainFont = compact ? "clamp(10px, 5cqw, 20px)" : "clamp(14px, 12cqw, 48px)";
  const smallFont = compact ? "clamp(8px, 4cqw, 14px)" : "clamp(12px, 6cqw, 24px)";
  const cornerMain = compact ? "clamp(10px, 6cqw, 18px)" : "clamp(14px, 12cqw, 48px)";
  const cornerSub = compact ? "clamp(8px, 5cqw, 14px)" : "clamp(12px, 10cqw, 36px)";
  const cornerSmall = compact ? "clamp(7px, 3cqw, 11px)" : "clamp(10px, 6cqw, 22px)";
  const imageSrc = config.useVial && WELLNEST_VIAL_IMAGES[config.useVial]
    ? WELLNEST_VIAL_IMAGES[config.useVial]
    : WELLNEST_DR_REDDY_IMAGE;

  const faceX = (() => {
    const raw = config.faceX;
    if (compact) return raw;
    const match = raw.match(/^(\d+(?:\.\d+)?)%$/);
    if (!match) return raw;
    const pct = parseFloat(match[1]);
    const nudged = Math.max(12, Math.min(75, pct - 16));
    return `${nudged}%`;
  })();
  const faceY = config.faceY;

  const baseProps = {
    role: alt ? ("img" as const) : undefined,
    "aria-label": alt || undefined,
  };

  const textShadowStr = `
    3px 3px 0 #111,
    -1px -1px 0 #111,
    1px -1px 0 #111,
    -1px 1px 0 #111,
    1px 1px 0 #111,
    0 8px 16px rgba(0,0,0,0.8)
  `;

  const TextBlock = ({
    text,
    highlight,
    isSmall,
  }: {
    text: string;
    highlight?: boolean;
    isSmall?: boolean;
  }) => {
    if (!text) return null;
    return (
      <div
        style={{
          fontFamily: "'Arial Black', sans-serif",
          fontWeight: 900,
          textTransform: "uppercase",
          lineHeight: 1.1,
          color: highlight ? "#111" : "#fff",
          fontSize: isSmall ? smallFont : mainFont,
          background: highlight ? config.themeColor : "transparent",
          padding: highlight ? "0.5cqw 2cqw" : "0",
          borderRadius: highlight ? "1cqw" : "0",
          textShadow: highlight ? "none" : textShadowStr,
          display: "inline-block",
          marginBottom: "1cqw",
          position: "relative",
          zIndex: 4,
          transform: highlight ? "rotate(-2deg)" : "none",
        }}
      >
        {text}
      </div>
    );
  };

  const faceImg = (
    <img
      src={imageSrc}
      alt=""
      className="wellnest-thumb-face"
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: `${faceX} ${faceY}`,
        transform: `scale(${config.faceScale})`,
        transformOrigin: `${faceX} ${faceY}`,
        zIndex: 1,
      }}
      onError={(e) => {
        if (config.useVial) (e.target as HTMLImageElement).src = WELLNEST_DR_REDDY_IMAGE;
      }}
    />
  );

  const containerStyle: React.CSSProperties = {
    aspectRatio: "1280/720",
    width: "100%",
    position: "relative",
    overflow: "hidden",
    borderRadius: "8px",
    containerType: "inline-size",
    background: "#111",
  };

  if (config.layout === "split-left" || config.layout === "split-right") {
    const isRight = config.layout === "split-right";
    return (
      <div className={`wellnest-thumb ${className ?? ""}`} style={containerStyle} {...baseProps}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: isRight
              ? "linear-gradient(90deg, #111 30%, transparent 80%)"
              : "linear-gradient(270deg, #111 30%, transparent 80%)",
            zIndex: 2,
          }}
        />
        {faceImg}
        <div
          style={{
            position: "absolute",
            top: "10%",
            bottom: "10%",
            [isRight ? "left" : "right"]: "6%",
            width: compact ? "42%" : "45%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: isRight ? "flex-start" : "flex-end",
            textAlign: isRight ? "left" : "right",
            zIndex: 3,
          }}
        >
          <TextBlock text={config.text1} highlight={config.highlightLine === 1} />
          <TextBlock text={config.text2 || ""} highlight={config.highlightLine === 2} />
          <TextBlock text={config.text3 || ""} isSmall />
        </div>
      </div>
    );
  }

  if (config.layout === "bottom-text") {
    return (
      <div className={`wellnest-thumb ${className ?? ""}`} style={containerStyle} {...baseProps}>
        {faceImg}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(0deg, rgba(17,17,17,0.92) 0%, rgba(17,17,17,0.5) ${compact ? "35%" : "45%"}, transparent 70%)`,
            zIndex: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "8%",
            left: "5%",
            right: "5%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            zIndex: 3,
            maxHeight: compact ? "38%" : "none",
          }}
        >
          <TextBlock text={config.text1} highlight={config.highlightLine === 1} />
          <TextBlock text={config.text2 || ""} highlight={config.highlightLine === 2} />
        </div>
      </div>
    );
  }

  if (config.layout === "corner-box") {
    return (
      <div className={`wellnest-thumb ${className ?? ""}`} style={containerStyle} {...baseProps}>
        {faceImg}
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            right: "6%",
            background: config.themeColor,
            padding: compact ? "1.5cqw 2cqw" : "3cqw 4cqw",
            borderRadius: "2cqw",
            transform: "rotate(-3deg)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            textAlign: "right",
            maxWidth: compact ? "55%" : "none",
          }}
        >
          <div
            style={{
              fontFamily: "'Arial Black', sans-serif",
              fontWeight: 900,
              color: "#111",
              fontSize: cornerMain,
              lineHeight: 1.1,
            }}
          >
            {config.text1}
          </div>
          {config.text2 && (
            <div
              style={{
                fontFamily: "'Arial Black', sans-serif",
                fontWeight: 900,
                color: "#fff",
                fontSize: cornerSub,
                lineHeight: 1.1,
                marginTop: "0.5cqw",
              }}
            >
              {config.text2}
            </div>
          )}
          {config.text3 && (
            <div
              style={{
                fontFamily: "sans-serif",
                fontWeight: 700,
                color: "#111",
                fontSize: cornerSmall,
                marginTop: "1.5cqw",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              {config.text3}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export function WellnestThumbnail({
  imageKey,
  className,
  alt,
  compact,
}: WellnestThumbnailProps) {
  const config = getWellnestThumbnailSlide(imageKey);
  if (!config) return null;
  return (
    <ThumbnailByConfig
      config={config}
      className={className}
      alt={alt}
      compact={compact}
    />
  );
}
