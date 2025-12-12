import { useContext } from 'react';
import { ErrorContext } from '../context/ErrorContext';

export const useError = () => {
    return useContext(ErrorContext);
};
