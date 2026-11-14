import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useEffect,
} from "react";

const TransformContext = createContext(null);

function useTransformContext() {
  return useContext(TransformContext);
}

export const TransformWrapper = forwardRef(function TransformWrapper(
  {
    children,
    initialScale = 1,
    minScale = 0.8,
    maxScale = 8,
    wheel = { step: 0.15 },
    onTransformed,
  },
  ref
) {
  const [transform, setTransformState] = useState({
    scale: initialScale,
    positionX: 0,
    positionY: 0,
  });

  const [isAnimating, setIsAnimating] = useState(false);
  const transformRef = useRef(transform);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const onTransformedRef = useRef(onTransformed);
  useEffect(() => {
    onTransformedRef.current = onTransformed;
  }, [onTransformed]);

  const setTransform = useCallback(
    (x, y, scale, animTime = 0) => {
      const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
      const newState = {
        scale: clampedScale,
        positionX: x,
        positionY: y,
      };

      if (animTime > 0) {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), animTime);
      }

      setTransformState(newState);

      const callback = onTransformedRef.current;
      if (callback) {
        callback({ scale: clampedScale, positionX: x, positionY: y }, newState);
      }
    },
    [minScale, maxScale]
  );

  const resetTransform = useCallback(
    (animTime = 150) => {
      setTransform(0, 0, initialScale, animTime);
    },
    [initialScale, setTransform]
  );

  const zoomIn = useCallback(
    (step = 0.3, animTime = 150) => {
      const curr = transformRef.current;
      const targetScale = Math.min(maxScale, curr.scale * (1 + step));
      const factor = targetScale / curr.scale;
      const newX = curr.positionX * factor;
      const newY = curr.positionY * factor;
      setTransform(newX, newY, targetScale, animTime);
    },
    [maxScale, setTransform]
  );

  const zoomOut = useCallback(
    (step = 0.3, animTime = 150) => {
      const curr = transformRef.current;
      const targetScale = Math.max(minScale, curr.scale / (1 + step));
      const factor = targetScale / curr.scale;
      const newX = curr.positionX * factor;
      const newY = curr.positionY * factor;
      setTransform(newX, newY, targetScale, animTime);
    },
    [minScale, setTransform]
  );

  useImperativeHandle(
    ref,
    () => ({
      setTransform,
      resetTransform,
      zoomIn,
      zoomOut,
      state: transformRef.current,
    }),
    [setTransform, resetTransform, zoomIn, zoomOut]
  );

  const contextValue = {
    transform,
    setTransform,
    resetTransform,
    zoomIn,
    zoomOut,
    minScale,
    maxScale,
    wheelStep: wheel.step || 0.15,
    isAnimating,
  };

  return (
    <TransformContext.Provider value={contextValue}>
      {children}
    </TransformContext.Provider>
  );
});

export function TransformComponent({
  children,
  wrapperStyle = {},
  contentStyle = {},
}) {
  const {
    transform,
    setTransform,
    minScale,
    maxScale,
    wheelStep,
    isAnimating,
  } = useTransformContext();

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const containerRef = useRef(null);

  // Wheel zoom centered on cursor
  const handleWheel = (e) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1 + wheelStep : 1 / (1 + wheelStep);
    const newScale = Math.max(minScale, Math.min(maxScale, transform.scale * zoomFactor));
    const effectiveFactor = newScale / transform.scale;

    const newX = mouseX - (mouseX - transform.positionX) * effectiveFactor;
    const newY = mouseY - (mouseY - transform.positionY) * effectiveFactor;

    setTransform(newX, newY, newScale, 0);
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: transform.positionX,
      posY: transform.positionY,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = dragStartRef.current.posX + dx;
    const newY = dragStartRef.current.posY + dy;

    setTransform(newX, newY, transform.scale, 0);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        ...wrapperStyle,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `translate(${transform.positionX}px, ${transform.positionY}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          transition: isAnimating ? "transform 0.15s ease-out" : "none",
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default TransformWrapper;
