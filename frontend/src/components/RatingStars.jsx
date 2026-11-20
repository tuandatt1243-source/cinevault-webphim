import { Star } from 'lucide-react';

export function RatingStars({ value = 0, interactive = false, onChange, size = 'sm' }) {
  const dim = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';

  return (
    <div className="inline-flex items-center gap-0.5" role={interactive ? 'radiogroup' : undefined} aria-label="Đánh giá sao">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        if (!interactive) {
          return (
            <Star
              key={star}
              aria-hidden="true"
              className={`${dim} ${
                filled ? 'fill-[#E0A43B] text-[#E0A43B]' : 'fill-transparent text-[#3B3A38]'
              }`}
            />
          );
        }
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={`Chấm ${star} trên 5 sao`}
            onClick={() => onChange?.(star)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              aria-hidden="true"
              className={`${dim} ${
                star <= value ? 'fill-[#E0A43B] text-[#E0A43B]' : 'fill-transparent text-[#57534E] hover:text-[#E0A43B]/70'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
