import type { DragEvent } from "react";

export type ChatAttachmentType = "image" | "design";

export interface ChatAttachment {
  id: string;
  url: string;
  name: string;
  type: ChatAttachmentType;
}

type ToastType = "info" | "warning" | "error";

interface HandleImageDropUploadOptions {
  event: DragEvent<HTMLElement>;
  attachedFiles: ChatAttachment[];
  uploadImage: (file: File) => Promise<void>;
  showToast: (message: string, type?: ToastType) => void;
}

export const isDraggingFiles = (event: DragEvent<HTMLElement>) =>
  Array.from(event.dataTransfer.types).includes("Files");

export const preventDefaultDragBehavior = (event: DragEvent<HTMLElement>) => {
  event.preventDefault();
  event.stopPropagation();
};

export const handleImageDropUpload = async ({
  event,
  attachedFiles,
  uploadImage,
  showToast,
}: HandleImageDropUploadOptions) => {
  preventDefaultDragBehavior(event);

  const droppedFiles = Array.from(event.dataTransfer.files);
  if (droppedFiles.length === 0) return;

  const imageFiles = droppedFiles.filter((file) => file.type.startsWith("image/"));

  if (imageFiles.length === 0) {
    showToast("请拖拽图片文件到对话框上传", "warning");
    return;
  }

  if (imageFiles.length !== droppedFiles.length) {
    showToast("已忽略非图片文件，拖拽上传仅支持图片", "warning");
  }

  if (attachedFiles.some((file) => file.type === "design")) {
    showToast("不能同时上传图片和设计文件，请先移除已上传的设计文件", "warning");
    return;
  }

  const currentImageCount = attachedFiles.filter((file) => file.type === "image").length;
  const remainingSlots = 3 - currentImageCount;

  if (remainingSlots <= 0) {
    showToast("最多只能上传 3 张图片", "warning");
    return;
  }

  const filesToUpload = imageFiles.slice(0, remainingSlots);

  if (imageFiles.length > remainingSlots) {
    showToast("最多只能上传 3 张图片，超出部分已忽略", "warning");
  }

  await Promise.all(filesToUpload.map(uploadImage));
};
