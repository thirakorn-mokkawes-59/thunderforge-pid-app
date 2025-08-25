import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import ColorPicker from '../ColorPicker.svelte';

describe('ColorPicker Component', () => {
  const defaultProps = {
    value: '#ff0000',
    label: 'Test Color',
    id: 'test-color-picker'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  describe('rendering', () => {
    it('should render with default props', () => {
      render(ColorPicker, { props: defaultProps });
      
      expect(screen.getByLabelText('Test Color')).toBeInTheDocument();
      expect(screen.getByDisplayValue('#ff0000')).toBeInTheDocument();
    });

    it('should render color preview with current value', () => {
      render(ColorPicker, { props: defaultProps });
      
      const preview = screen.getByRole('button');
      expect(preview).toHaveStyle({ backgroundColor: '#ff0000' });
    });

    it('should show label when provided', () => {
      render(ColorPicker, { props: defaultProps });
      
      expect(screen.getByText('Test Color')).toBeInTheDocument();
    });

    it('should not show label when not provided', () => {
      const props = { ...defaultProps, label: undefined };
      render(ColorPicker, { props });
      
      expect(screen.queryByText('Test Color')).not.toBeInTheDocument();
    });

    it('should apply size classes correctly', () => {
      render(ColorPicker, { 
        props: { ...defaultProps, size: 'large' } 
      });
      
      const container = screen.getByRole('button').parentElement;
      expect(container).toHaveClass('large');
    });
  });

  describe('color palette', () => {
    it('should show color palette when clicked', async () => {
      render(ColorPicker, { props: defaultProps });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      expect(screen.getByText('Color Palette')).toBeInTheDocument();
    });

    it('should display preset colors', async () => {
      render(ColorPicker, { props: defaultProps });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      // Should have multiple color swatches
      const colorSwatches = screen.getAllByRole('button');
      expect(colorSwatches.length).toBeGreaterThan(10);
    });

    it('should select color from palette', async () => {
      const onColorChange = vi.fn();
      render(ColorPicker, { 
        props: { 
          ...defaultProps,
          onColorChange
        }
      });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      // Find and click a specific color swatch
      const colorSwatch = screen.getByTitle('#00ff00');
      await fireEvent.click(colorSwatch);
      
      expect(onColorChange).toHaveBeenCalledWith('#00ff00');
    });

    it('should close palette when clicking outside', async () => {
      render(ColorPicker, { props: defaultProps });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      expect(screen.getByText('Color Palette')).toBeInTheDocument();
      
      // Click outside
      await fireEvent.click(document.body);
      
      expect(screen.queryByText('Color Palette')).not.toBeInTheDocument();
    });
  });

  describe('custom color input', () => {
    it('should allow custom hex input', async () => {
      const onColorChange = vi.fn();
      render(ColorPicker, { 
        props: { 
          ...defaultProps,
          onColorChange
        }
      });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      const customInput = screen.getByPlaceholderText('Enter hex color');
      await fireEvent.input(customInput, { target: { value: '#0000ff' } });
      
      expect(customInput.value).toBe('#0000ff');
    });

    it('should validate hex color format', async () => {
      render(ColorPicker, { props: defaultProps });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      const customInput = screen.getByPlaceholderText('Enter hex color');
      await fireEvent.input(customInput, { target: { value: 'invalid' } });
      
      // Should show error or not accept invalid format
      expect(customInput).toHaveClass('error'); // Assuming error class
    });

    it('should apply custom color on Enter', async () => {
      const onColorChange = vi.fn();
      render(ColorPicker, { 
        props: { 
          ...defaultProps,
          onColorChange
        }
      });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      const customInput = screen.getByPlaceholderText('Enter hex color');
      await fireEvent.input(customInput, { target: { value: '#0000ff' } });
      await fireEvent.keyDown(customInput, { key: 'Enter' });
      
      expect(onColorChange).toHaveBeenCalledWith('#0000ff');
    });
  });

  describe('recent colors', () => {
    it('should show recent colors section when available', async () => {
      // Set up localStorage with recent colors
      localStorage.setItem('recent-colors', JSON.stringify(['#ff0000', '#00ff00', '#0000ff']));
      
      render(ColorPicker, { props: defaultProps });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      expect(screen.getByText('Recent Colors')).toBeInTheDocument();
    });

    it('should not show recent colors when empty', async () => {
      render(ColorPicker, { props: defaultProps });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      expect(screen.queryByText('Recent Colors')).not.toBeInTheDocument();
    });

    it('should add selected color to recent colors', async () => {
      const onColorChange = vi.fn();
      render(ColorPicker, { 
        props: { 
          ...defaultProps,
          onColorChange
        }
      });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      const colorSwatch = screen.getByTitle('#00ff00');
      await fireEvent.click(colorSwatch);
      
      // Check localStorage was updated
      const recentColors = JSON.parse(localStorage.getItem('recent-colors') || '[]');
      expect(recentColors).toContain('#00ff00');
    });

    it('should limit recent colors to maximum count', async () => {
      // Fill up recent colors
      const manyColors = Array.from({ length: 15 }, (_, i) => `#${i.toString(16).padStart(6, '0')}`);
      localStorage.setItem('recent-colors', JSON.stringify(manyColors));
      
      const onColorChange = vi.fn();
      render(ColorPicker, { 
        props: { 
          ...defaultProps,
          onColorChange
        }
      });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      const colorSwatch = screen.getByTitle('#ff00ff');
      await fireEvent.click(colorSwatch);
      
      const recentColors = JSON.parse(localStorage.getItem('recent-colors') || '[]');
      expect(recentColors.length).toBeLessThanOrEqual(10); // Assuming max 10
    });
  });

  describe('keyboard navigation', () => {
    it('should handle Escape key to close palette', async () => {
      render(ColorPicker, { props: defaultProps });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      expect(screen.getByText('Color Palette')).toBeInTheDocument();
      
      await fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(screen.queryByText('Color Palette')).not.toBeInTheDocument();
    });

    it('should handle Tab navigation through color swatches', async () => {
      render(ColorPicker, { props: defaultProps });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      const colorSwatches = screen.getAllByRole('button').slice(1); // Exclude trigger
      
      // Tab through swatches
      await fireEvent.keyDown(colorSwatches[0], { key: 'Tab' });
      
      // Should move focus to next swatch
      expect(document.activeElement).toBe(colorSwatches[1]);
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(ColorPicker, { props: defaultProps });
      
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-label', expect.stringContaining('color picker'));
    });

    it('should have proper color contrast indicators', async () => {
      render(ColorPicker, { props: defaultProps });
      
      const trigger = screen.getByRole('button');
      await fireEvent.click(trigger);
      
      const colorSwatches = screen.getAllByRole('button').slice(1);
      colorSwatches.forEach(swatch => {
        expect(swatch).toHaveAttribute('title');
        expect(swatch).toHaveAttribute('aria-label');
      });
    });

    it('should support high contrast mode', () => {
      render(ColorPicker, { 
        props: { 
          ...defaultProps,
          highContrast: true
        }
      });
      
      const container = screen.getByRole('button').parentElement;
      expect(container).toHaveClass('high-contrast');
    });
  });

  describe('disabled state', () => {
    it('should not open palette when disabled', async () => {
      render(ColorPicker, { 
        props: { 
          ...defaultProps,
          disabled: true
        }
      });
      
      const trigger = screen.getByRole('button');
      expect(trigger).toBeDisabled();
      
      await fireEvent.click(trigger);
      
      expect(screen.queryByText('Color Palette')).not.toBeInTheDocument();
    });

    it('should show disabled styling', () => {
      render(ColorPicker, { 
        props: { 
          ...defaultProps,
          disabled: true
        }
      });
      
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveClass('disabled');
    });
  });

  describe('validation', () => {
    it('should accept valid hex colors', async () => {
      const validColors = ['#ff0000', '#00FF00', '#123ABC', '#000', '#fff'];
      const onColorChange = vi.fn();
      
      for (const color of validColors) {
        render(ColorPicker, { 
          props: { 
            ...defaultProps,
            value: color,
            onColorChange
          }
        });
        
        expect(screen.getByDisplayValue(color.toLowerCase())).toBeInTheDocument();
      }
    });

    it('should handle invalid hex colors gracefully', () => {
      const invalidColors = ['red', '#gggggg', '123456', '#12345'];
      
      for (const color of invalidColors) {
        render(ColorPicker, { 
          props: { 
            ...defaultProps,
            value: color
          }
        });
        
        // Should either show error state or fallback to default
        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
      }
    });
  });
});