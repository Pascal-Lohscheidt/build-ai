// eslint-disable-next-line
import h from 'solid-js/h';
import { Accessor, Component, Setter, Show } from 'solid-js';

type CursorGraphicProps = {
  width?: number;
  height?: number;
  setRef: Setter<SVGSVGElement | undefined>;
  isShowingCursor: Accessor<boolean>;
};

const CursorGraphic: Component<CursorGraphicProps> = (props) => {
  const width = props.width || 100;
  const height = props.height || 100;

  return (
    <Show when={props.isShowingCursor}>
      <svg
        ref={(el) => {
          props.setRef(el);
        }}
        width={width}
        height={height}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g clip-path="url(#clip0_3576_285)">
          <path
            class="cursor-path"
            d="M2.14849 7.04749C1.35153 4.07321 4.07319 1.35155 7.04747 2.14851L77.3148 20.9766C80.2891 21.7735 81.2853 25.4914 79.108 27.6687L27.6687 79.108C25.4914 81.2853 21.7735 80.2891 20.9766 77.3149L2.14849 7.04749Z"
            fill="currentColor"
          />
        </g>
        <defs>
          <clipPath id="clip0_3576_285">
            <rect width="100" height="100" fill="white" />
          </clipPath>
        </defs>
      </svg>
    </Show>
  );
};

export default CursorGraphic;
