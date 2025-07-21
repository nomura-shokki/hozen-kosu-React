// jquery-clock-timepicker.d.ts
import "jquery";

declare module "jquery" {
  interface JQuery<TElement = HTMLElement> {
    clockTimePicker(options?: {
      alwaysSelectHoursFirst?: boolean;
      precision?: number;
      i18n?: { cancelButton?: string };
      onAdjust?: (newVal: string, oldVal: string) => void;
    }): JQuery<TElement>;
  }
}
