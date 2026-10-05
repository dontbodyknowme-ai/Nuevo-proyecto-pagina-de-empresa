---
name: Frontend Design
description: Create modern, beautiful, and responsive web page designs with best practices in UI/UX, typography, color theory, spacing, and animations
---

# Frontend Design

Use this skill to create stunning, modern web page designs that are both beautiful and functional.

## Design Principles

### 1. Visual Hierarchy
- Use size, color, and spacing to guide the user's attention
- Most important elements should be largest and most prominent
- Use the F-pattern or Z-pattern for layout flow
- Create clear focal points on each section

### 2. Typography
- Use a maximum of 2-3 font families per page
- Establish a clear type scale (e.g., 12px, 14px, 16px, 20px, 24px, 32px, 48px, 64px)
- Use line height of 1.5-1.75 for body text
- Use line height of 1.2-1.3 for headings
- Ensure sufficient contrast between text and background (WCAG AA: 4.5:1 for normal text)

### 3. Color Theory
- Use a consistent color palette (primary, secondary, accent, neutral)
- Follow the 60-30-10 rule: 60% dominant color, 30% secondary, 10% accent
- Use tools like Coolors.co or Adobe Color to generate palettes
- Ensure color contrast meets accessibility standards
- Use CSS custom properties (variables) for colors

### 4. Spacing and Layout
- Use a consistent spacing scale (e.g., 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px)
- Use generous whitespace to avoid clutter
- Use CSS Grid or Flexbox for layouts
- Maintain consistent margins and padding
- Use max-width containers (typically 1200px-1400px)

### 5. Responsive Design
- Design mobile-first, then scale up
- Use breakpoints: 640px, 768px, 1024px, 1280px
- Test on multiple screen sizes
- Use relative units (rem, em, %) instead of fixed pixels where appropriate
- Ensure touch targets are at least 44x44px

## Modern Design Trends (2024-2025)

### Visual Style
- **Glassmorphism**: Frosted glass effects with backdrop-filter
- **Neumorphism**: Soft, extruded look with subtle shadows
- **Dark mode**: Offer dark theme options
- **Gradients**: Subtle, modern gradients (especially in buttons and backgrounds)
- **Micro-interactions**: Hover effects, transitions, and animations
- **3D elements**: Subtle depth with shadows and transforms
- **Bold typography**: Large, expressive headings
- **Minimalism**: Clean, uncluttered layouts

### Components
- Cards with subtle shadows and rounded corners (border-radius: 8px-16px)
- Floating action buttons
- Sticky navigation headers
- Hero sections with background images or gradients
- Testimonial carousels
- Pricing tables
- Feature grids
- FAQ accordions
- Modal dialogs
- Toast notifications

### Animations
- Use CSS transitions for hover effects (duration: 200-300ms)
- Use CSS keyframe animations for entrance effects
- Implement scroll-triggered animations with Intersection Observer
- Use transform and opacity for performance (avoid animating layout properties)
- Respect `prefers-reduced-motion` media query

## Implementation Guidelines

### CSS Architecture
```css
/* Use CSS custom properties */
:root {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --color-accent: #f59e0b;
  --color-text: #1f2937;
  --color-bg: #ffffff;
  --spacing-unit: 8px;
  --radius: 12px;
  --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

/* Use modern CSS features */
.container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: calc(var(--spacing-unit) * 3);
}
```

### Performance
- Optimize images (WebP format, lazy loading)
- Minimize CSS and JavaScript
- Use system fonts or optimize web font loading
- Implement code splitting for JavaScript
- Use CSS containment for complex components

### Accessibility
- Use semantic HTML elements
- Add alt text to all images
- Ensure keyboard navigation works
- Use ARIA labels where needed
- Test with screen readers
- Maintain focus indicators

## Workflow

1. **Understand the requirements**: What is the page's purpose? Who is the target audience?
2. **Create a wireframe**: Sketch the layout structure
3. **Choose a color palette**: Select colors that match the brand and purpose
4. **Select typography**: Choose readable, attractive fonts
5. **Build the layout**: Implement with HTML and CSS
6. **Add components**: Implement buttons, cards, forms, etc.
7. **Add animations**: Implement subtle, meaningful animations
8. **Test responsiveness**: Test on multiple screen sizes
9. **Optimize performance**: Minimize assets, optimize images
10. **Test accessibility**: Check contrast, keyboard navigation, screen readers

## Resources

- **Color palettes**: Coolors.co, Adobe Color, ColorHunt
- **Icons**: Heroicons, Phosphor Icons, Lucide
- **Images**: Unsplash, Pexels
- **Fonts**: Google Fonts, Fontshare
- **Inspiration**: Awwwards, Dribbble, Behance, Land-book
- **CSS Tools**: Tailwind CSS, CSS Gradient, Shadow Palette Generator
