'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface AddressResult {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  lat: number;
  lng: number;
  formatted: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

interface Prediction {
  place_id: string;
  description: string;
}

function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[]
): {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
} {
  let streetNumber = '';
  let route = '';
  let city = '';
  let state = '';
  let postalCode = '';
  let country = '';

  for (const component of components) {
    const types = component.types;
    if (types.includes('street_number')) {
      streetNumber = component.long_name;
    } else if (types.includes('route')) {
      route = component.long_name;
    } else if (types.includes('locality')) {
      city = component.long_name;
    } else if (types.includes('sublocality_level_1') && !city) {
      city = component.long_name;
    } else if (types.includes('administrative_area_level_1')) {
      state = component.short_name;
    } else if (types.includes('postal_code')) {
      postalCode = component.long_name;
    } else if (types.includes('country')) {
      country = component.short_name;
    }
  }

  const street = [streetNumber, route].filter(Boolean).join(' ');
  return { street, city, state, postal_code: postalCode, country };
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing an address...',
  id,
  className,
  disabled,
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Poll for Google Maps readiness and init services
  useEffect(() => {
    const check = () => {
      if (window.google?.maps?.places?.AutocompleteService) {
        serviceRef.current = new window.google.maps.places.AutocompleteService();
        geocoderRef.current = new window.google.maps.Geocoder();
        setIsReady(true);
        return true;
      }
      return false;
    };

    if (check()) return;

    const interval = setInterval(() => {
      if (check()) clearInterval(interval);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchPredictions = useCallback((input: string) => {
    if (!serviceRef.current || input.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    serviceRef.current.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'us' },
        types: ['address'],
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(
            results.map((r) => ({ place_id: r.place_id, description: r.description }))
          );
          setShowDropdown(true);
        } else {
          setPredictions([]);
          setShowDropdown(false);
        }
      }
    );
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300);
  };

  const handleSelect = async (prediction: Prediction) => {
    onChange(prediction.description);
    setPredictions([]);
    setShowDropdown(false);

    if (!geocoderRef.current) return;

    try {
      const response = await geocoderRef.current.geocode({ placeId: prediction.place_id });
      const result = response.results[0];
      if (!result) return;

      const parsed = parseAddressComponents(result.address_components);
      const lat = result.geometry.location.lat();
      const lng = result.geometry.location.lng();

      onSelect({
        ...parsed,
        lat,
        lng,
        formatted: prediction.description,
      });
    } catch (error) {
      console.error('Geocode error:', error);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        id={id}
        value={value}
        onChange={handleInput}
        onFocus={() => {
          if (predictions.length > 0) setShowDropdown(true);
        }}
        disabled={disabled || !isReady}
        placeholder={isReady ? placeholder : 'Loading...'}
        className={className}
        autoComplete="off"
      />
      {showDropdown && predictions.length > 0 && (
        <ul
          className={cn(
            'absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md',
            'max-h-60 overflow-auto'
          )}
        >
          {predictions.map((prediction) => (
            <li
              key={prediction.place_id}
              onClick={() => void handleSelect(prediction)}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {prediction.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
