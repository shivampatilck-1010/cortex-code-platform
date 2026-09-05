'use client';

import React from 'react';

interface LanguageIconProps {
  languageId: string;
  className?: string;
  size?: number;
}

export const LanguageIcon: React.FC<LanguageIconProps> = ({
  languageId,
  className = '',
  size = 16,
}) => {
  const id = languageId.toLowerCase();

  switch (id) {
    // 1. Python (Iconic Blue & Gold Interlocking Snakes)
    case 'python':
    case 'py':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 110 110"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <path
            d="M54.5 4C30.5 4 32 14.5 32 14.5L32.1 25.5H55V29H18.5C6 29 4.5 41 4.5 47.5C4.5 55 12.5 57 18.5 57H25V48C25 38.5 33.5 38.5 33.5 38.5H55C62.5 38.5 64.5 33 64.5 28.5V14.5C64.5 6.5 57.5 4 54.5 4ZM44 11C46.2 11 48 12.8 48 15C48 17.2 46.2 19 44 19C41.8 19 40 17.2 40 15C40 12.8 41.8 11 44 11Z"
            fill="#3776AB"
          />
          <path
            d="M55.5 106C79.5 106 78 95.5 78 95.5L77.9 84.5H55V81H91.5C104 81 105.5 69 105.5 62.5C105.5 55 97.5 53 91.5 53H85V62C85 71.5 76.5 71.5 76.5 71.5H55C47.5 71.5 45.5 77 45.5 81.5V95.5C45.5 103.5 52.5 106 55.5 106ZM66 99C63.8 99 62 97.2 62 95C62 92.8 63.8 91 66 91C68.2 91 70 92.8 70 95C70 97.2 68.2 99 66 99Z"
            fill="#FFD43B"
          />
        </svg>
      );

    // 2. C++ (Official Dark Blue Hexagon / Badge with C++)
    case 'cpp':
    case 'c++':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <path
            d="M117.5 33.5L67.5 4.5C65.5 3.5 62.5 3.5 60.5 4.5L10.5 33.5C8.5 34.5 7.5 37 7.5 39.5V97.5C7.5 100 8.5 102.5 10.5 103.5L60.5 132.5C62.5 133.5 65.5 133.5 67.5 132.5L117.5 103.5C119.5 102.5 120.5 100 120.5 97.5V39.5C120.5 37 119.5 34.5 117.5 33.5Z"
            fill="#00599C"
          />
          <path
            d="M58 87C44.7 87 34 76.3 34 63C34 49.7 44.7 39 58 39C66 39 72.8 42.8 77 48.8L66.7 55.2C64.5 51.8 61.5 50 58 50C50.8 50 45 55.8 45 63C45 70.2 50.8 76 58 76C61.5 76 64.5 74.2 66.7 70.8L77 77.2C72.8 83.2 66 87 58 87ZM87 55H93V62H100V68H93V75H87V68H80V62H87V55ZM107 55H113V62H120V68H113V75H107V68H100V62H107V55Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    // 3. C (Official Blue Hexagon with C)
    case 'c':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <path
            d="M117.5 33.5L67.5 4.5C65.5 3.5 62.5 3.5 60.5 4.5L10.5 33.5C8.5 34.5 7.5 37 7.5 39.5V97.5C7.5 100 8.5 102.5 10.5 103.5L60.5 132.5C62.5 133.5 65.5 133.5 67.5 132.5L117.5 103.5C119.5 102.5 120.5 100 120.5 97.5V39.5C120.5 37 119.5 34.5 117.5 33.5Z"
            fill="#A8B9CC"
          />
          <path
            d="M64 92C46.3 92 32 77.7 32 60C32 42.3 46.3 28 64 28C74.6 28 83.7 33.1 89.3 41.1L75.6 49.6C72.7 45.1 68.7 42.7 64 42.7C54.4 42.7 46.7 50.4 46.7 60C46.7 69.6 54.4 77.3 64 77.3C68.7 77.3 72.7 74.9 75.6 70.4L89.3 78.9C83.7 86.9 74.6 92 64 92Z"
            fill="#283593"
          />
        </svg>
      );

    // 4. JavaScript (Official Yellow Badge with JS)
    case 'javascript':
    case 'js':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <rect width="128" height="128" rx="16" fill="#F7DF1E" />
          <path
            d="M34 100C34 105 38 108 45 108C51 108 55 104 55 97V54H43V95C43 98 42 99 39 99C36 99 35 98 34 95L34 100ZM74 100C77 106 83 108 90 108C99 108 105 103 105 94C105 86 100 82 91 78L88 77C82 74 80 72 80 68C80 64 83 61 88 61C93 61 96 63 98 67L108 61C104 54 97 51 88 51C78 51 70 56 70 66C70 74 74 78 84 82L87 83C93 86 95 88 95 93C95 97 91 100 85 100C79 100 75 97 73 92L63 98C65 103 70 106 74 100Z"
            fill="#000000"
          />
        </svg>
      );

    // 5. TypeScript (Official Blue Badge with TS)
    case 'typescript':
    case 'ts':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <rect width="128" height="128" rx="16" fill="#3178C6" />
          <path
            d="M30 45H68V55H54V105H44V55H30V45ZM74 100C77 106 83 108 90 108C99 108 105 103 105 94C105 86 100 82 91 78L88 77C82 74 80 72 80 68C80 64 83 61 88 61C93 61 96 63 98 67L108 61C104 54 97 51 88 51C78 51 70 56 70 66C70 74 74 78 84 82L87 83C93 86 95 88 95 93C95 97 91 100 85 100C79 100 75 97 73 92L63 98C65 103 70 106 74 100Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    // 6. Java (Official Steam Cup)
    case 'java':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <path
            d="M48.5 73C48.5 73 53 76.5 61 76.5C70 76.5 77 71 77 71C77 71 83 80 60 83C41 85.5 48.5 73 48.5 73Z"
            fill="#EA2D2E"
          />
          <path
            d="M43 89C43 89 50 93.5 63 93.5C75 93.5 86 88 86 88C86 88 89 97 62 100C39 102.5 43 89 43 89Z"
            fill="#EA2D2E"
          />
          <path
            d="M62 14C53 24 57 32 57 32C57 32 45 22 55 10C63 0 68 1 62 14Z"
            fill="#5382A1"
          />
          <path
            d="M74 21C65 31 69 39 69 39C69 39 57 29 67 17C75 7 80 8 74 21Z"
            fill="#5382A1"
          />
          <path
            d="M87 97C87 97 92 100 86 103C78 107 50 107 41 103C36 100.5 42 97 42 97C42 97 29 104 46 109C63 114 96 111 101 104C105 98 87 97 87 97Z"
            fill="#5382A1"
          />
          <path
            d="M89 78C95 82 99 87 99 92C99 99 90 102 78 103L81 99C88 98 94 96 94 92C94 88 90 85 86 81L89 78Z"
            fill="#EA2D2E"
          />
        </svg>
      );

    // 7. Rust (Official Gear Emblem)
    case 'rust':
    case 'rs':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <circle cx="64" cy="64" r="56" stroke="#DEA584" strokeWidth="12" strokeDasharray="16 10" />
          <circle cx="64" cy="64" r="44" fill="#000000" />
          <path
            d="M48 40H66C74 40 80 44 80 52C80 58 76 62 70 63L82 88H69L59 66H56V88H48V40ZM56 58H65C68 58 71 56 71 53C71 50 68 48 65 48H56V58Z"
            fill="#DEA584"
          />
        </svg>
      );

    // 8. Go (Official Cyan Go Logo)
    case 'go':
    case 'golang':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <rect width="128" height="128" rx="20" fill="#00ADD8" />
          <path
            d="M48 68C48 76 43 83 33 83C21 83 14 74 14 62C14 50 22 41 34 41C42 41 46 45 47 50H37C36 48 35 47 33 47C27 47 23 53 23 62C23 71 27 77 33 77C37 77 39 74 40 70H33V64H48V68ZM58 54C68 54 75 62 75 72C75 82 68 90 58 90C48 90 41 82 41 72C41 62 48 54 58 54ZM58 60C53 60 49 65 49 72C49 79 53 84 58 84C63 84 67 79 67 72C67 65 63 60 58 60ZM80 56H88V88H80V56Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    // 9. C# (Purple Badge with C#)
    case 'csharp':
    case 'c#':
    case 'cs':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <rect width="128" height="128" rx="20" fill="#239120" />
          <path
            d="M58 88C42 88 30 76 30 64C30 52 42 40 58 40C68 40 75 45 79 52L68 59C66 55 62 52 58 52C51 52 44 58 44 64C44 70 51 76 58 76C62 76 66 73 68 69L79 76C75 83 68 88 58 88ZM88 52L90 40H97L95 52H105V59H94L92 69H102V76H91L89 88H82L84 76H74L72 88H65L67 76H57V69H68L70 59H60V52H71L73 40H80L78 52H88ZM86 59H76L74 69H84L86 59Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    // 10. PHP (Purple / Blue Oval)
    case 'php':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <ellipse cx="64" cy="64" rx="60" ry="36" fill="#777BB4" />
          <path
            d="M36 78H28L34 50H46C52 50 56 53 54 59C53 65 47 70 41 70H34L32 78H36ZM36 64H41C44 64 47 62 48 59C48 56 46 55 43 55H38L36 64ZM62 78H54L60 50H68L65 62H75L78 50H86L80 78H72L74 67H64L62 78ZM96 78H88L94 50H106C112 50 116 53 114 59C113 65 107 70 101 70H94L92 78H96ZM96 64H101C104 64 107 62 108 59C108 56 106 55 103 55H98L96 64Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    // 11. Ruby (Faceted Red Gem)
    case 'ruby':
    case 'rb':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <path d="M24 40L44 14H84L104 40L64 114L24 40Z" fill="#CC342D" />
          <path d="M44 14L64 40L84 14H44Z" fill="#FF6B6B" />
          <path d="M64 40L64 114L84 40H64Z" fill="#E82C2A" />
          <path d="M64 40L64 114L44 40H64Z" fill="#B31B1B" />
          <path d="M24 40L44 40L64 114L24 40Z" fill="#8B1010" />
          <path d="M104 40L84 40L64 114L104 40Z" fill="#E82C2A" />
        </svg>
      );

    // 12. Kotlin (Purple / Orange Gradient Polygon)
    case 'kotlin':
    case 'kt':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="kt-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7F52FF" />
              <stop offset="50%" stopColor="#C711E1" />
              <stop offset="100%" stopColor="#E4485D" />
            </linearGradient>
          </defs>
          <path d="M118 10L10 118H118V10Z" fill="url(#kt-grad)" />
          <path d="M10 10H118L64 64L10 10Z" fill="#7F52FF" />
          <path d="M10 10L64 64L10 118V10Z" fill="#C711E1" />
        </svg>
      );

    // 13. Swift (Orange Bird Emblem)
    case 'swift':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <rect width="128" height="128" rx="24" fill="#F05138" />
          <path
            d="M100 86C78 104 46 100 30 84C46 94 66 90 74 82C62 82 50 74 44 64C50 66 56 66 60 64C48 58 42 46 44 34C48 40 56 46 66 48C68 32 80 22 94 22C86 28 84 38 88 46C96 42 104 38 110 32C106 40 100 46 94 48C94 48 108 58 100 86Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    // 14. Dart (Blue / Teal Wing Badge)
    case 'dart':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <path d="M22 22L70 14L106 50L60 106L14 70L22 22Z" fill="#0175C2" />
          <path d="M60 106L106 50L70 14L22 22L60 106Z" fill="#02569B" opacity="0.8" />
          <path d="M50 14L114 78L78 114L14 50L50 14Z" fill="#00B4AB" />
        </svg>
      );

    // 15. SQL (Cylindrical Database Stack)
    case 'sql':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <ellipse cx="64" cy="28" rx="44" ry="16" fill="#00758F" />
          <path
            d="M20 28V52C20 61 40 68 64 68C88 68 108 61 108 52V28C108 37 88 44 64 44C40 44 20 37 20 28Z"
            fill="#005A6F"
          />
          <path
            d="M20 52V76C20 85 40 92 64 92C88 92 108 85 108 76V52C108 61 88 68 64 68C40 68 20 61 20 52Z"
            fill="#00758F"
          />
          <path
            d="M20 76V100C20 109 40 116 64 116C88 116 108 109 108 100V76C108 85 88 92 64 92C40 92 20 85 20 76Z"
            fill="#F29111"
          />
        </svg>
      );

    // 16. R (Blue Statistical Oval)
    case 'r':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`flex-shrink-0 ${className}`}
        >
          <ellipse cx="64" cy="64" rx="56" ry="44" fill="#276DC3" />
          <ellipse cx="64" cy="64" rx="40" ry="28" fill="#FFFFFF" />
          <path
            d="M52 46H74C82 46 88 50 88 56C88 62 82 66 74 66H62V82H52V46ZM62 58H72C75 58 78 57 78 56C78 54 75 53 72 53H62V58ZM75 66L89 82H76L65 67L75 66Z"
            fill="#1E4472"
          />
        </svg>
      );

    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-[#ff9100] ${className}`}
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
  }
};
