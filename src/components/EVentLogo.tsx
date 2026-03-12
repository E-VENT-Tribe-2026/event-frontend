export function EVentLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-labelledby="event-logo-title"
      {...props}
    >
      <title id="event-logo-title">E-VENT Logo</title>
      <rect x="4" y="4" width="72" height="72" rx="20" fill="#F34A6A" />
      <path
        d="M26 24h26c2.2 0 4 1.8 4 4s-1.8 4-4 4H32v6h14c2.2 0 4 1.8 4 4s-1.8 4-4 4H32v6h20c2.2 0 4 1.8 4 4s-1.8 4-4 4H26c-2.2 0-4-1.8-4-4V28c0-2.2 1.8-4 4-4z"
        fill="white"
      />
      <g transform="translate(46 42)">
        <circle cx="8" cy="8" r="6" fill="#18B5A5" />
        <path
          d="M8 0C4.7 0 2 2.7 2 6c0 4.6 6 10 6 10s6-5.4 6-10c0-3.3-2.7-6-6-6z"
          fill="white"
          fillOpacity="0.9"
        />
        <circle cx="8" cy="6" r="2.4" fill="#18B5A5" />
      </g>
    </svg>
  );
}

