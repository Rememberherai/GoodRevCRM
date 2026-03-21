'use client';

import { useRef } from 'react';
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from 'use-places-autocomplete';
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
  const listRef = useRef<HTMLUListElement>(null);

  const {
    ready,
    suggestions: { status, data },
    setValue: setPlacesValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: 'us' },
      types: ['address'],
    },
    debounce: 300,
  });

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setPlacesValue(val);
  };

  const handleSelect = async (description: string) => {
    onChange(description);
    setPlacesValue(description, false);
    clearSuggestions();

    try {
      const results = await getGeocode({ address: description });
      const firstResult = results[0];
      if (!firstResult) return;

      const { lat, lng } = await getLatLng(firstResult);
      const parsed = parseAddressComponents(firstResult.address_components);

      onSelect({
        ...parsed,
        lat,
        lng,
        formatted: description,
      });
    } catch (error) {
      console.error('Geocode error:', error);
    }
  };

  const showSuggestions = status === 'OK' && data.length > 0;

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={handleInput}
        disabled={disabled || !ready}
        placeholder={ready ? placeholder : 'Loading...'}
        className={className}
        autoComplete="off"
      />
      {showSuggestions && (
        <ul
          ref={listRef}
          className={cn(
            'absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md',
            'max-h-60 overflow-auto'
          )}
        >
          {data.map(({ place_id, description }) => (
            <li
              key={place_id}
              onClick={() => void handleSelect(description)}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
