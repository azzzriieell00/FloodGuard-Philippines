"use client";

export default function MapControls() {
  const goHome = () => {
    window.dispatchEvent(
      new CustomEvent("floodguard-map-home")
    );
  };

  const zoomIn = () => {
    window.dispatchEvent(
      new CustomEvent("floodguard-map-zoom-in")
    );
  };

  const zoomOut = () => {
    window.dispatchEvent(
      new CustomEvent("floodguard-map-zoom-out")
    );
  };

  return (
    <div className="fg-map-controls">
      <button
        type="button"
        aria-label="Show entire Philippines"
        title="Show entire Philippines"
        onClick={goHome}
      >
        <span>⌂</span>
      </button>

      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        onClick={zoomIn}
      >
        <span>+</span>
      </button>

      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={zoomOut}
      >
        <span>−</span>
      </button>
    </div>
  );
}