import { locationHref, locationLabel } from '@shared/location';

describe('locationHref', () => {
  it('keeps a pasted Google Maps or Waze link as it is', () => {
    expect(locationHref('https://maps.app.goo.gl/abc123')).toBe('https://maps.app.goo.gl/abc123');
    expect(locationHref(' https://waze.com/ul/hsv8x ')).toBe('https://waze.com/ul/hsv8x');
  });
  it('adds https to a link pasted without it', () => {
    expect(locationHref('maps.app.goo.gl/abc123')).toBe('https://maps.app.goo.gl/abc123');
  });
  it('turns a typed address into a Google Maps search', () => {
    expect(locationHref('Avenues Mall, Kuwait')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Avenues%20Mall%2C%20Kuwait'
    );
  });
  it('gives nothing for an empty location', () => {
    expect(locationHref('  ')).toBeNull();
    expect(locationHref(null)).toBeNull();
  });
});

describe('locationLabel', () => {
  it('names the app a link opens in', () => {
    expect(locationLabel('https://waze.com/ul/hsv8x')).toBe('Open in Waze');
    expect(locationLabel('https://maps.app.goo.gl/abc')).toBe('Open in Google Maps');
    expect(locationLabel('https://www.google.com/maps/place/x')).toBe('Open in Google Maps');
  });
  it('shows a typed address itself', () => {
    expect(locationLabel('Avenues Mall, Kuwait')).toBe('Avenues Mall, Kuwait');
  });
  it('calls any other link a location', () => {
    expect(locationLabel('https://example.com/spot')).toBe('Open location');
  });
});
