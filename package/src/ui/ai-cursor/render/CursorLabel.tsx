import {
  Accessor,
  Component,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from 'solid-js';

import {
  offset,
  shift,
  flip,
  autoUpdate,
  computePosition,
} from '@floating-ui/dom';

type LabelProps = {
  text: string;
  targetRef: Accessor<SVGSVGElement | undefined>;
};

/**
 * The cursor label is the part where the title of the AI or (user if you may)
 * is displayed.
 *
 * This component gets in-active if it does not find a cursor to attach itself to.
 * We use the floating-ui library to position the label. It is powerful and battle-tested.
 */
const CursorLabel: Component<LabelProps> = (props: LabelProps) => {
  const [labelRef, setLabelRef] = createSignal<HTMLSpanElement | undefined>(
    undefined
  );
  const [hasSetupLabel, setHasSetupLabel] = createSignal<boolean>(false);

  const renderLabelBasedOnTargetRef = createMemo(() => () => {
    const targetRef = props.targetRef();
    const label = labelRef();
    if (!label || !targetRef) return;

    const updatePosition = (): void => {
      computePosition(targetRef, label, {
        placement: 'bottom',
        middleware: [
          offset({
            mainAxis: 12,
            crossAxis: 12,
          }),
          flip(),
          shift({ padding: 6 }),
        ],
      }).then(({ x, y }) => {
        if (label) {
          Object.assign(label.style, {
            left: `${x}px`,
            top: `${y}px`,
            position: 'absolute',
          });
        }
      });
    };

    updatePosition();
    const cleanup = autoUpdate(targetRef, label, updatePosition);

    onCleanup(() => {
      cleanup();
      setHasSetupLabel(false);
    });
  });

  const isShowingLabel = createMemo(() => props.targetRef());

  createEffect(() => {
    if (!isShowingLabel() || hasSetupLabel() || !labelRef()) {
      return;
    }

    renderLabelBasedOnTargetRef()();
    setHasSetupLabel(true);
  });

  return (
    <Show when={isShowingLabel}>
      <span
        ref={(el) => {
          setLabelRef(el);
        }}
      >
        {props.text}
      </span>
    </Show>
  );
};

export default CursorLabel;
