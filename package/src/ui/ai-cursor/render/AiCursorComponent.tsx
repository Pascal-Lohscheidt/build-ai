// eslint-disable-next-line
import h from 'solid-js/h';
// eslint-disable-next-line
import { Fragment } from 'solid-js/h/jsx-runtime';

import { Timeline, createTimeline } from 'animejs';
import { Component, createSignal, onMount } from 'solid-js';
import CursorGraphic from './CursorGraphic';
import CursorLabel from './CursorLabel';

interface DefineHook<T> {
  (fn: T): void;
}

export type Props = {
  /**
   * The event hooks are functions that let you connect the inner logic of the solid js component and the AiCursor Class that acts
   * as an API.
   */
  eventHooks: {
    defineSetPosition: DefineHook<(position: [number, number]) => void>;
    defineAddPositionToQueue: DefineHook<(position: [number, number]) => void>;
    definePlayQueue: DefineHook<() => void>;
    defineSetShowCursor: DefineHook<(show: boolean) => void>;
  };
};

const AiCursorComponent: Component<Props> = (props: Props) => {
  let cursorParentRef!: HTMLDivElement;
  const [cursorGraphicRef, setCursorGraphicRef] = createSignal<
    SVGSVGElement | undefined
  >(undefined);
  const [isShowingCursor, setIsShowingCursor] = createSignal<boolean>(true);
  const [, setCurrentTimeline] = createSignal<Timeline | undefined>(undefined);
  // Using onMount instead of createEffect to avoid potential infinite loops
  // createEffect runs after every render and dependency change
  onMount(() => {
    const timeline = createTimeline({ defaults: { duration: 750 } });

    setCurrentTimeline(timeline);

    props.eventHooks.defineSetPosition((position) => {
      timeline.add(cursorParentRef, {
        translateX: position[0],
        translateY: position[1],
        duration: 1,
      });
      timeline.play();
    });

    props.eventHooks.defineAddPositionToQueue((position) => {
      timeline.add(cursorParentRef, {
        translateX: position[0],
        translateY: position[1],
        duration: 1000,
      });
    });

    props.eventHooks.defineSetShowCursor((show) => {
      setIsShowingCursor(show);
    });

    props.eventHooks.definePlayQueue(() => {
      timeline.play();
    });
  });

  return (
    <>
      <div
        ref={(el) => {
          cursorParentRef = el;
        }}
        class="ai-cursor"
        style={{
          position: 'absolute',
          top: '0%',
          left: '0%',
          'pointer-events': isShowingCursor() ? 'auto' : 'none',
        }}
      >
        <CursorGraphic
          width={24}
          height={24}
          setRef={setCursorGraphicRef}
          isShowingCursor={isShowingCursor}
        />
      </div>
      <CursorLabel text="Hello" targetRef={cursorGraphicRef} />
    </>
  );
};

export default AiCursorComponent;
