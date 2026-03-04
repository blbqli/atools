"use client";

import { type ChangeEvent, type DragEvent, useCallback, useRef, useState } from "react";

type UseFileDropzoneOptions = {
  onFile?: (file: File) => void;
  onFiles?: (files: File[]) => void;
  multiple?: boolean;
  clearInputAfterChange?: boolean;
};

type DropzoneDragEvent = DragEvent<HTMLElement>;

export function useFileDropzone(options: UseFileDropzoneOptions) {
  const { onFile, onFiles, multiple = false, clearInputAfterChange = true } = options;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const emitFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const nextFiles = multiple ? files : [files[0]];
      if (onFiles) onFiles(nextFiles);
      if (onFile && nextFiles[0]) onFile(nextFiles[0]);
    },
    [multiple, onFile, onFiles],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      emitFiles(files);
      if (clearInputAfterChange) event.target.value = "";
    },
    [clearInputAfterChange, emitFiles],
  );

  const handleDrop = useCallback(
    (event: DropzoneDragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      emitFiles(files);
    },
    [emitFiles],
  );

  const handleDragOver = useCallback((event: DropzoneDragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DropzoneDragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    inputRef,
    isDragging,
    handleInputChange,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    openFilePicker,
  };
}
