import { Link } from 'react-router-dom';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  linkTo?: string;
  className?: string;
}

const sizes = {
  sm: { box: 'h-7 w-7 rounded-lg',   text: 'text-lg',   letter: 'text-sm'  },
  md: { box: 'h-9 w-9 rounded-xl',   text: 'text-xl',   letter: 'text-base' },
  lg: { box: 'h-14 w-14 rounded-2xl', text: 'text-3xl', letter: 'text-2xl' },
};

export default function AppLogo({ size = 'md', linkTo, className = '' }: AppLogoProps) {
  const s = sizes[size];

  const content = (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${s.box} gradient-primary flex items-center justify-center shadow-glow shrink-0`}>
        <span className={`${s.letter} font-bold text-primary-foreground`}>E</span>
      </div>
      <span className={`${s.text} font-bold text-gradient leading-none`}>E-VENT</span>
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo}>{content}</Link>;
  }
  return content;
}
