// Shared alert utilities

import Swal from 'sweetalert2';

export const showAlert = (
  message: string, 
  type: 'success' | 'error' | 'info' | 'warning' = 'info', 
  customTitle?: string, 
  isDarkMode: boolean = true
) => {
  document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  
  const titles = {
    success: 'Success!',
    error: 'Error',
    warning: 'Warning',
    info: 'Information'
  };
  
  const hasNewlines = message.includes('\n');
  const alertOptions: any = {
    title: customTitle || titles[type],
    icon: type,
    background: isDarkMode ? '#222' : '#fff',
    color: isDarkMode ? '#fff' : '#333',
    confirmButtonColor: '#3085d6',
    confirmButtonText: 'OK'
  };

  if (hasNewlines) {
    alertOptions.html = message.replace(/\n/g, '<br>');
  } else {
    alertOptions.text = message;
  }

  Swal.fire(alertOptions);
};

export const showInputAlert = async (
  message: string,
  defaultValue: string = '',
  placeholder: string = '',
  isDarkMode: boolean = true
): Promise<string | null> => {
  document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  
  const result = await Swal.fire({
    title: 'Enter filename',
    text: message,
    input: 'text',
    inputValue: defaultValue,
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: 'Save',
    cancelButtonText: 'Cancel',
    background: isDarkMode ? '#222' : '#fff',
    color: isDarkMode ? '#fff' : '#333',
    confirmButtonColor: '#28a745',
    cancelButtonColor: '#6c757d',
    inputValidator: (value) => {
      if (!value || !value.trim()) {
        return 'Please enter a filename';
      }
      return null;
    }
  });

  return result.isConfirmed ? result.value : null;
};

export const showConfirm = async (
  message: string,
  isDarkMode: boolean = true,
  title: string = 'Confirm',
  confirmText: string = 'Yes',
  cancelText: string = 'Cancel'
): Promise<boolean> => {
  document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

  const result = await Swal.fire({
    title,
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    background: isDarkMode ? '#222' : '#fff',
    color: isDarkMode ? '#fff' : '#333',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d'
  });

  return result.isConfirmed === true;
};
