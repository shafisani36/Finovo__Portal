import React from "react";
import {
  CustomDropdown,
  CustomDropdownProps,
  SelectOption,
  CustomCheckboxDropdown,
  CustomCheckboxDropdownProps,
  CustomActionDropdown,
  CustomActionDropdownProps,
  CheckboxDropdownItem,
  ActionMenuItem,
} from "./CustomDropdown";

export type {
  SelectOption,
  CustomDropdownProps,
  CustomCheckboxDropdownProps,
  CustomActionDropdownProps,
  CheckboxDropdownItem,
  ActionMenuItem,
};

export interface CustomSelectProps extends CustomDropdownProps {}

export const CustomSelect: React.FC<CustomSelectProps> = (props) => {
  return <CustomDropdown fullWidth {...props} />;
};

export { CustomDropdown, CustomCheckboxDropdown, CustomActionDropdown };
export default CustomDropdown;
