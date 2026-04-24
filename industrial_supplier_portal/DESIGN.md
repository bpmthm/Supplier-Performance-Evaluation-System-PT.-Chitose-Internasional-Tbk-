---
name: Industrial Supplier Portal
colors:
  surface: '#f7fafc'
  surface-dim: '#d7dadc'
  surface-bright: '#f7fafc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f4f6'
  surface-container: '#ebeef0'
  surface-container-high: '#e5e9eb'
  surface-container-highest: '#e0e3e5'
  on-surface: '#181c1e'
  on-surface-variant: '#454653'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eef1f3'
  outline: '#767685'
  outline-variant: '#c6c5d6'
  surface-tint: '#4551c8'
  primary: '#434fc6'
  on-primary: '#ffffff'
  primary-container: '#5d69e1'
  on-primary-container: '#fffdff'
  inverse-primary: '#bdc2ff'
  secondary: '#4e6073'
  on-secondary: '#ffffff'
  secondary-container: '#cfe2f9'
  on-secondary-container: '#526478'
  tertiary: '#595c66'
  on-tertiary: '#ffffff'
  tertiary-container: '#72757f'
  on-tertiary-container: '#fffdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#bdc2ff'
  on-primary-fixed: '#000667'
  on-primary-fixed-variant: '#2a36af'
  secondary-fixed: '#d1e4fb'
  secondary-fixed-dim: '#b5c8df'
  on-secondary-fixed: '#091d2e'
  on-secondary-fixed-variant: '#36485b'
  tertiary-fixed: '#e0e2ee'
  tertiary-fixed-dim: '#c4c6d2'
  on-tertiary-fixed: '#181b24'
  on-tertiary-fixed-variant: '#434750'
  background: '#f7fafc'
  on-background: '#181c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  gutter: 24px
  margin-page: 40px
---

## Brand & Style

The design system is engineered for precision, reliability, and high-velocity information processing. It serves an industrial audience where clarity and efficiency are paramount. The aesthetic follows a **Corporate Modern** approach—striking a balance between a utilitarian tool and a premium professional environment. 

The visual language communicates stability through structured layouts and a cold, focused color palette. By prioritizing whitespace and removing unnecessary decorative elements, the design system ensures that complex supply chain data remains the primary focus, reducing cognitive load for users managing high volumes of logistical information.

## Colors

The color strategy is restrained and purposeful, utilizing the cool spectrum to evoke a sense of technical competence. 

*   **Primary Blue:** Extracted from the reference header, this vibrant blue acts as the primary signal for navigation and key actions.
*   **Deep Navy:** Used for text and secondary structural elements to provide high-contrast legibility.
*   **Subtle Grays:** A range of cool-toned grays (`#F4F7F9` to `#CFD8DC`) creates soft differentiation between background layers and container surfaces without the need for heavy borders.
*   **Functional Accents:** Success, warning, and error states should use desaturated versions of green and red to maintain the professional, eye-friendly atmosphere.

## Typography

The design system utilizes **Inter** for its exceptional legibility in data-heavy environments. The typeface’s tall x-height and neutral character make it ideal for the technical requirements of an industrial portal.

The type scale is built on a strict hierarchy. Headlines use a slightly tighter letter spacing and heavier weights to anchor page sections, while body text maintains a generous line height to ensure long lists and data tables remain "eye-friendly" during extended use. Labels for status chips and technical identifiers use uppercase or semi-bold weights at smaller sizes to maximize space efficiency without sacrificing readability.

## Layout & Spacing

This design system employs a **Fixed Grid** model for desktop views, centering content within a 1280px container to prevent excessive eye travel on ultra-wide industrial monitors. 

A 12-column system is used with a consistent 24px gutter. The spacing rhythm is strictly based on a 4px baseline, ensuring that every element—from the height of an input field to the padding within a data cell—is mathematically aligned. This rigorous approach to spacing mirrors the precision of industrial engineering.

## Elevation & Depth

To maintain a clean and modern aesthetic, the design system avoids heavy drop shadows in favor of **Tonal Layers** and **Low-Contrast Outlines**.

*   **Background:** The lowest layer is the page background in a light cool gray.
*   **Surface Tier 1:** White cards and containers use a very soft, 1px border (`#E0E4EC`) instead of shadows to define their boundaries.
*   **Surface Tier 2:** Modals and dropdowns use a subtle "ambient" shadow—low opacity (8%), wide blur (16px), and no offset—to indicate temporary elevation above the workspace.

## Shapes

The design system uses a **Soft** shape language (4px - 8px radius). This slight rounding softens the "cold" industrial color palette, making the interface feel approachable and modern while retaining a professional, geometric structure.

*   **Buttons & Inputs:** 4px (Soft) to maintain a crisp, engineered look.
*   **Cards & Modals:** 8px (Rounded-lg) to create a clear visual distinction for major content containers.
*   **Badges/Chips:** Full pill-shape (100px) to distinguish them from interactive buttons.

## Components

### Buttons
Primary buttons use the Industrial Blue with white text. Secondary buttons utilize a ghost style with a 1px navy border. All buttons have a fixed height of 40px for consistency in forms.

### Data Tables
The core of the portal. Tables feature a light gray header row with semi-bold labels. Rows have a subtle hover state (`#F0F2F5`) and utilize 16px horizontal cell padding.

### Input Fields
Fields are white with a light gray border that transitions to the Primary Blue on focus. Labels are always positioned above the field for maximum legibility.

### Status Badges
Utilize a light background version of the status color (e.g., light green background with dark green text) to indicate order statuses like "Shipped," "Pending," or "Delayed."

### Sidebar Navigation
A slim, dark-themed sidebar (using the Secondary Navy) houses high-contrast white icons. This creates a clear permanent anchor for the user's workflow, as seen in the reference image.