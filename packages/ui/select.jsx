/** Select composition adapted from happyhands-site packages/ui/shadcn/select.tsx
 * (2c4e0a0, shadcn radix-luma). Same Radix Select 2.4.1, semantic CSS instead
 * of the site's Tailwind build. Keyboard, focus, typeahead and positioning
 * remain in Radix; this wrapper only applies the HappyHands presentation.
 */
import * as React from 'react';
import * as Primitive from '@radix-ui/react-select';
const Chevron = ({ up = false }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={up ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'} />
  </svg>
);
export const Select = Primitive.Root;
export const SelectValue = Primitive.Value;
export const SelectGroup = Primitive.Group;
export const SelectLabel = Primitive.Label;
export const SelectTrigger = React.forwardRef(function SelectTrigger(
  { children, ...props },
  ref,
) {
  return (
    <Primitive.Trigger
      {...props}
      ref={ref}
      data-slot="select-trigger"
      className="hh-select-trigger hh-shadcn"
    >
      {children}
      <Primitive.Icon asChild>
        <Chevron />
      </Primitive.Icon>
    </Primitive.Trigger>
  );
});
export function SelectContent({ children, container, ...props }) {
  return (
    <Primitive.Portal container={container}>
      <Primitive.Content
        {...props}
        data-slot="select-content"
        className="hh-select-menu hh-shadcn"
        position="popper"
        align="start"
        sideOffset={6}
        collisionPadding={8}
      >
        <Primitive.ScrollUpButton className="hh-select-scroll">
          <Chevron up />
        </Primitive.ScrollUpButton>
        <Primitive.Viewport data-slot="select-viewport">
          {children}
        </Primitive.Viewport>
        <Primitive.ScrollDownButton className="hh-select-scroll">
          <Chevron />
        </Primitive.ScrollDownButton>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
export function SelectItem({ children, ...props }) {
  return (
    <Primitive.Item
      {...props}
      data-slot="select-item"
      className="hh-select-option"
    >
      <Primitive.ItemText>{children}</Primitive.ItemText>
      <Primitive.ItemIndicator className="hh-select-check">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12 4 4L19 6" />
        </svg>
      </Primitive.ItemIndicator>
    </Primitive.Item>
  );
}
