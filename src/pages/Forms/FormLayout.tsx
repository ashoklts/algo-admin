import { useState, type ReactNode } from "react";

import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import Checkbox from "../../components/form/input/Checkbox";
import Input from "../../components/form/input/InputField";
import Radio from "../../components/form/input/Radio";
import TextArea from "../../components/form/input/TextArea";

const subjectOptions = [
  { value: "option-1", label: "Option 1" },
  { value: "option-2", label: "Option 2" },
  { value: "option-3", label: "Option 3" },
  { value: "option-4", label: "Option 4" },
];

const categoryOptions = [
  { value: "category-1", label: "Category 1" },
  { value: "category-2", label: "Category 2" },
  { value: "category-3", label: "Category 3" },
];

const countryOptions = [
  { value: "usa", label: "USA" },
  { value: "canada", label: "Canada" },
];

const iconClassName =
  "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400";

function InputWithIcon({
  id,
  type,
  placeholder,
  icon,
}: {
  id: string;
  type: string;
  placeholder: string;
  icon: ReactNode;
}) {
  return (
    <div className="relative">
      <span className={iconClassName}>{icon}</span>
      <Input id={id} type={type} placeholder={placeholder} className="pl-11" />
    </div>
  );
}

export default function FormLayout() {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [gender, setGender] = useState("male");
  const [membership, setMembership] = useState("free");

  return (
    <div>
      <PageMeta
        title="React.js Form Layout Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Form Layout page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Form Layout" />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ComponentCard
            title="Basic Form"
            className="[&>div:first-child]:flex [&>div:first-child]:items-center [&>div:first-child]:justify-between"
          >
            <button className="rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600">
              Submit
            </button>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <Label htmlFor="basic-name">Name</Label>
                <Input id="basic-name" type="text" placeholder="Enter your full name" />
              </div>
              <div>
                <Label htmlFor="basic-email">Email</Label>
                <Input id="basic-email" type="email" placeholder="Enter your email" />
              </div>
              <div>
                <Label htmlFor="basic-password">Password</Label>
                <Input
                  id="basic-password"
                  type="password"
                  placeholder="Enter your password"
                />
              </div>
              <div>
                <Label htmlFor="basic-message">Message</Label>
                <TextArea
                  placeholder="Type your message"
                  rows={6}
                  className="resize-none"
                />
              </div>
            </div>
          </ComponentCard>

          <ComponentCard title="Example Form">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="first-name">First Name</Label>
                <Input id="first-name" type="text" placeholder="Enter first name" />
              </div>
              <div>
                <Label htmlFor="last-name">Last Name</Label>
                <Input id="last-name" type="text" placeholder="Enter last name" />
              </div>
            </div>

            <div>
              <Label htmlFor="email-address">Email</Label>
              <Input id="email-address" type="email" placeholder="Enter your email" />
            </div>

            <div>
              <Label htmlFor="subject-select">Select Subject</Label>
              <div className="relative">
                <Select
                  options={subjectOptions}
                  placeholder="Select Subject"
                  defaultValue=""
                  onChange={setSubject}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
              <input id="subject-select" type="hidden" value={subject} readOnly />
            </div>

            <div>
              <Label htmlFor="message">Message</Label>
              <TextArea
                placeholder="Type your message"
                rows={6}
                className="resize-none"
              />
            </div>

            <button className="inline-flex rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600">
              Send Message
            </button>
          </ComponentCard>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <ComponentCard title="Example Form with Icons">
              <div>
                <Label htmlFor="icon-email">Email</Label>
                <InputWithIcon
                  id="icon-email"
                  type="email"
                  placeholder="Enter your email"
                  icon={
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3.33398 5.83333L9.01995 9.81451C9.59788 10.2191 10.4034 10.2191 10.9814 9.81451L16.6673 5.83333M5.33398 15.8333H14.6673C15.7719 15.8333 16.6673 14.9379 16.6673 13.8333V6.16667C16.6673 5.0621 15.7719 4.16667 14.6673 4.16667H5.33398C4.22941 4.16667 3.33398 5.0621 3.33398 6.16667V13.8333C3.33398 14.9379 4.22941 15.8333 5.33398 15.8333Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
              </div>

              <div>
                <Label htmlFor="icon-password">Password</Label>
                <InputWithIcon
                  id="icon-password"
                  type="password"
                  placeholder="Enter your password"
                  icon={
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M5.83398 8.33333V6.66667C5.83398 4.36548 7.69946 2.5 10.0007 2.5C12.3018 2.5 14.1673 4.36548 14.1673 6.66667V8.33333M10.0007 12.0833V12.9167M7.00065 17.5H13.0007C14.1052 17.5 15.0007 16.6046 15.0007 15.5V10.3333C15.0007 9.22876 14.1052 8.33333 13.0007 8.33333H7.00065C5.89608 8.33333 5.00065 9.22876 5.00065 10.3333V15.5C5.00065 16.6046 5.89608 17.5 7.00065 17.5Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
              </div>

              <Checkbox
                checked={rememberMe}
                onChange={setRememberMe}
                label="Remember me"
              />

              <button className="inline-flex w-full items-center justify-center rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600">
                Create Account
              </button>
            </ComponentCard>
          </div>

          <div className="xl:col-span-8">
            <ComponentCard title="Example Form">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-800 dark:text-white/90">
                    Personal Info
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="personal-first-name">First Name</Label>
                    <Input
                      id="personal-first-name"
                      type="text"
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="personal-last-name">Last Name</Label>
                    <Input
                      id="personal-last-name"
                      type="text"
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div>
                  <Label>Gender</Label>
                  <div className="flex flex-wrap items-center gap-8">
                    <Radio
                      id="gender-male"
                      name="gender"
                      value="male"
                      checked={gender === "male"}
                      label="Male"
                      onChange={setGender}
                    />
                    <Radio
                      id="gender-female"
                      name="gender"
                      value="female"
                      checked={gender === "female"}
                      label="Female"
                      onChange={setGender}
                    />
                    <Radio
                      id="gender-others"
                      name="gender"
                      value="others"
                      checked={gender === "others"}
                      label="Others"
                      onChange={setGender}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" type="date" />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <div className="relative">
                      <Select
                        options={categoryOptions}
                        placeholder="Select Category"
                        defaultValue=""
                        onChange={setCategory}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M5 7.5L10 12.5L15 7.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </div>
                    <input id="category" type="hidden" value={category} readOnly />
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="text-lg font-medium text-gray-800 dark:text-white/90">
                    Address
                  </h4>
                </div>

                <div>
                  <Label htmlFor="street">Street</Label>
                  <Input id="street" type="text" placeholder="Enter street address" />
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input id="city" type="text" placeholder="Enter city" />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input id="state" type="text" placeholder="Enter state" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="post-code">Post Code</Label>
                    <Input id="post-code" type="text" placeholder="Post code" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="country">Country</Label>
                    <div className="relative">
                      <Select
                        options={countryOptions}
                        placeholder="--Select Country--"
                        defaultValue=""
                        onChange={setCountry}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M5 7.5L10 12.5L15 7.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </div>
                    <input id="country" type="hidden" value={country} readOnly />
                  </div>
                </div>

                <div>
                  <Label>Membership:</Label>
                  <div className="flex flex-wrap items-center gap-8">
                    <Radio
                      id="membership-free"
                      name="membership"
                      value="free"
                      checked={membership === "free"}
                      label="Free"
                      onChange={setMembership}
                    />
                    <Radio
                      id="membership-paid"
                      name="membership"
                      value="paid"
                      checked={membership === "paid"}
                      label="Paid"
                      onChange={setMembership}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button className="inline-flex rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600">
                    Save Changes
                  </button>
                  <button className="inline-flex rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]">
                    Cancel
                  </button>
                </div>
              </div>
            </ComponentCard>
          </div>
        </div>
      </div>
    </div>
  );
}
