import { useState } from "react";

import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import TextArea from "../../components/form/input/TextArea";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import {
  AlertHexaIcon,
  CheckCircleIcon,
  ErrorHexaIcon,
  InfoIcon,
} from "../../icons";

type ModalType =
  | "default"
  | "centered"
  | "form"
  | "fullscreen"
  | "success"
  | "info"
  | "warning"
  | "danger"
  | null;

function SectionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
    >
      {label}
    </button>
  );
}

function ModalText() {
  return (
    <>
      <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque
        euismod est quis mauris lacinia pharetra. Sed a ligula ac odio
        condimentum aliquet a nec nulla. Aliquam bibendum ex sit amet ipsum
        rutrum feugiat ultrices enim quam.
      </p>
      <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque
        euismod est quis mauris lacinia pharetra. Sed a ligula ac odio.
      </p>
    </>
  );
}

function ModalFooter({ onClose }: { onClose: () => void }) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
      <Button onClick={onClose}>Save Changes</Button>
    </div>
  );
}

function AlertModalContent({
  title,
  description,
  tone,
  onClose,
}: {
  title: string;
  description: string;
  tone: "success" | "info" | "warning" | "danger";
  onClose: () => void;
}) {
  const toneMap = {
    success: {
      wrapper: "bg-success-50 text-success-500 dark:bg-success-500/10",
      icon: <CheckCircleIcon className="h-8 w-8" />,
    },
    info: {
      wrapper: "bg-blue-light-50 text-blue-light-500 dark:bg-blue-light-500/10",
      icon: <InfoIcon className="h-8 w-8" />,
    },
    warning: {
      wrapper: "bg-warning-50 text-warning-500 dark:bg-warning-500/10",
      icon: <AlertHexaIcon className="h-8 w-8" />,
    },
    danger: {
      wrapper: "bg-error-50 text-error-500 dark:bg-error-500/10",
      icon: <ErrorHexaIcon className="h-8 w-8" />,
    },
  };

  return (
    <div className="rounded-[20px] bg-white p-8 text-center dark:bg-gray-900">
      <div
        className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${toneMap[tone].wrapper}`}
      >
        {toneMap[tone].icon}
      </div>
      <h3 className="mt-6 text-[24px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white/90">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-[360px] text-sm leading-6 text-gray-500 dark:text-gray-400">
        {description}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-8 inline-flex rounded-xl bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
      >
        Okay, Got It
      </button>
    </div>
  );
}

export default function ModalsPage() {
  const [openModal, setOpenModal] = useState<ModalType>(null);

  const closeModal = () => setOpenModal(null);

  return (
    <div>
      <PageMeta
        title="React.js Modals Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Modals page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Modals" />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ComponentCard title="Default Modal">
            <SectionButton label="Open Modal" onClick={() => setOpenModal("default")} />
          </ComponentCard>

          <ComponentCard title="Vertically Centered Modal">
            <SectionButton
              label="Open Modal"
              onClick={() => setOpenModal("centered")}
            />
          </ComponentCard>

          <ComponentCard title="Form in Modal">
            <SectionButton label="Open Modal" onClick={() => setOpenModal("form")} />
          </ComponentCard>

          <ComponentCard title="Full Screen Modal">
            <SectionButton
              label="Open Modal"
              onClick={() => setOpenModal("fullscreen")}
            />
          </ComponentCard>
        </div>

        <ComponentCard title="Modal Based Alerts">
          <div className="flex flex-wrap gap-4">
            <SectionButton
              label="Success Alert"
              onClick={() => setOpenModal("success")}
            />
            <SectionButton label="Info Alert" onClick={() => setOpenModal("info")} />
            <SectionButton
              label="Warning Alert"
              onClick={() => setOpenModal("warning")}
            />
            <SectionButton
              label="Danger Alert"
              onClick={() => setOpenModal("danger")}
            />
          </div>
        </ComponentCard>
      </div>

      <Modal
        isOpen={openModal === "default"}
        onClose={closeModal}
        className="max-w-[700px] p-8 m-4"
      >
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
          Modal Heading
        </h3>
        <div className="mt-6 space-y-5">
          <ModalText />
        </div>
        <ModalFooter onClose={closeModal} />
      </Modal>

      <Modal
        isOpen={openModal === "centered"}
        onClose={closeModal}
        className="max-w-[500px] p-8 m-4"
      >
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success-50 text-success-500 dark:bg-success-500/10">
            <CheckCircleIcon className="h-8 w-8" />
          </div>
          <h3 className="mt-6 text-2xl font-semibold text-gray-900 dark:text-white/90">
            All Done! Success Confirmed
          </h3>
          <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            Pellentesque euismod est quis mauris lacinia pharetra.
          </p>
        </div>
        <ModalFooter onClose={closeModal} />
      </Modal>

      <Modal
        isOpen={openModal === "form"}
        onClose={closeModal}
        className="max-w-[700px] p-8 m-4"
      >
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
          Personal Information
        </h3>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="modal-first-name">First Name</Label>
            <Input id="modal-first-name" type="text" placeholder="Enter first name" />
          </div>
          <div>
            <Label htmlFor="modal-last-name">Last Name</Label>
            <Input id="modal-last-name" type="text" placeholder="Enter last name" />
          </div>
          <div>
            <Label htmlFor="modal-email">Email Address</Label>
            <Input id="modal-email" type="email" placeholder="Enter email address" />
          </div>
          <div>
            <Label htmlFor="modal-phone">Phone</Label>
            <Input id="modal-phone" type="text" placeholder="Enter phone number" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="modal-bio">Bio</Label>
            <TextArea rows={5} placeholder="Write a short bio" className="resize-none" />
          </div>
        </div>
        <ModalFooter onClose={closeModal} />
      </Modal>

      <Modal
        isOpen={openModal === "fullscreen"}
        onClose={closeModal}
        className="h-screen w-screen p-8"
        isFullscreen
      >
        <div className="mx-auto max-w-5xl rounded-[24px] bg-white p-8 shadow-2xl dark:bg-gray-900">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
            Modal Heading
          </h3>
          <div className="mt-6 space-y-5">
            <ModalText />
            <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit.
              Pellentesque euismod est quis mauris lacinia pharetra.
            </p>
          </div>
          <ModalFooter onClose={closeModal} />
        </div>
      </Modal>

      <Modal
        isOpen={openModal === "success"}
        onClose={closeModal}
        className="max-w-[460px] m-4"
        showCloseButton={false}
      >
        <AlertModalContent
          tone="success"
          title="Well Done!"
          description="Lorem ipsum dolor sit amet consectetur. Feugiat ipsum libero tempor felis risus nisi non. Quisque eu ut tempor curabitur."
          onClose={closeModal}
        />
      </Modal>

      <Modal
        isOpen={openModal === "info"}
        onClose={closeModal}
        className="max-w-[460px] m-4"
        showCloseButton={false}
      >
        <AlertModalContent
          tone="info"
          title="Information Alert!"
          description="Lorem ipsum dolor sit amet consectetur. Feugiat ipsum libero tempor felis risus nisi non. Quisque eu ut tempor curabitur."
          onClose={closeModal}
        />
      </Modal>

      <Modal
        isOpen={openModal === "warning"}
        onClose={closeModal}
        className="max-w-[460px] m-4"
        showCloseButton={false}
      >
        <AlertModalContent
          tone="warning"
          title="Warning Alert!"
          description="Lorem ipsum dolor sit amet consectetur. Feugiat ipsum libero tempor felis risus nisi non. Quisque eu ut tempor curabitur."
          onClose={closeModal}
        />
      </Modal>

      <Modal
        isOpen={openModal === "danger"}
        onClose={closeModal}
        className="max-w-[460px] m-4"
        showCloseButton={false}
      >
        <AlertModalContent
          tone="danger"
          title="Danger Alert!"
          description="Lorem ipsum dolor sit amet consectetur. Feugiat ipsum libero tempor felis risus nisi non. Quisque eu ut tempor curabitur."
          onClose={closeModal}
        />
      </Modal>
    </div>
  );
}
