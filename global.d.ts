declare namespace JSX {
  interface IntrinsicElements {
    'dotlottie-wc': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string;
      autoplay?: string | boolean;
      loop?: string | boolean;
      style?: React.CSSProperties;
    };
  }
}

export {};
