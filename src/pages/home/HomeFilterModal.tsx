import { Calendar, MapPin, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import DatePickerField from '@/components/DatePickerField';

type HomeFilterModalProps = {
  open: boolean;
  onClose: () => void;
  filterDate: string;
  minDate: string;
  onFilterDateChange: (value: string) => void;
  selectedCity: string;
  onSelectedCityChange: (value: string) => void;
  availableCities: string[];
  budgetMin: number;
  budgetMax: number;
  maxPrice: number;
  onBudgetMinChange: (value: number) => void;
  onBudgetMaxChange: (value: number) => void;
  onClearFilters: () => void;
};

export default function HomeFilterModal({
  open,
  onClose,
  filterDate,
  minDate,
  onFilterDateChange,
  selectedCity,
  onSelectedCityChange,
  availableCities,
  budgetMin,
  budgetMax,
  maxPrice,
  onBudgetMinChange,
  onBudgetMaxChange,
  onClearFilters,
}: HomeFilterModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm px-4 pb-4 sm:pb-0"
        >
          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 48 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="w-full max-w-sm rounded-3xl glass-card overflow-hidden bg-background border border-border shadow-xl"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border/40">
              <h3 className="text-base font-bold text-foreground">Filters</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close filters"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="home-filter-date" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> Event date
                </label>
                <DatePickerField
                  id="home-filter-date"
                  value={filterDate}
                  min={minDate}
                  allowEmpty
                  placeholder="Any date"
                  onChange={onFilterDateChange}
                  className="py-2.5 text-xs"
                />
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-accent" /> Location
                </span>
                <select
                  id="home-city-filter"
                  value={selectedCity}
                  onChange={(e) => onSelectedCityChange(e.target.value)}
                  className="rounded-xl bg-secondary px-3.5 py-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40 border border-border/50"
                  aria-label="Filter events by location"
                >
                  <option value="">All locations</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Budget range</span>
                  <span className="text-xs font-medium text-foreground">€{budgetMin} to €{budgetMax}</span>
                </div>
                <div className="relative h-6 flex items-center px-1">
                  <div className="absolute inset-x-0 h-1.5 rounded-full bg-secondary" />
                  <div
                    className="absolute h-1.5 rounded-full bg-primary pointer-events-none"
                    style={{
                      left: `${maxPrice > 0 ? (budgetMin / maxPrice) * 100 : 0}%`,
                      right: `${maxPrice > 0 ? 100 - (budgetMax / maxPrice) * 100 : 0}%`,
                    }}
                  />
                  <input type="range" min={0} max={maxPrice} value={budgetMin}
                    aria-label="Minimum budget"
                    onChange={(e) => onBudgetMinChange(Math.min(Number(e.target.value), budgetMax - 1))}
                    className="dual-range-input absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ zIndex: budgetMin > maxPrice * 0.9 ? 5 : 3 }}
                  />
                  <input type="range" min={0} max={maxPrice} value={budgetMax}
                    aria-label="Maximum budget"
                    onChange={(e) => onBudgetMaxChange(Math.max(Number(e.target.value), budgetMin + 1))}
                    className="dual-range-input absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ zIndex: 4 }}
                  />
                  <div className="absolute h-3.5 w-3.5 rounded-full bg-primary border-2 border-background shadow pointer-events-none"
                    style={{ left: `calc(${maxPrice > 0 ? (budgetMin / maxPrice) * 100 : 0}% - 7px)` }} />
                  <div className="absolute h-3.5 w-3.5 rounded-full bg-primary border-2 border-background shadow pointer-events-none"
                    style={{ left: `calc(${maxPrice > 0 ? (budgetMax / maxPrice) * 100 : 100}% - 7px)` }} />
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClearFilters}
                className="flex-1 rounded-2xl border border-border bg-secondary py-3 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl gradient-primary py-3 text-xs font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition-transform"
              >
                Apply filters
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
