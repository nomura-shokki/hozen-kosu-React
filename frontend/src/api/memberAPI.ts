import axios from 'axios';

const BASE_URL = 'http://127.0.0.1:8000/api/';

export const getMembers = async () => {
    const response = await axios.get(BASE_URL);
    return response.data;
};

export const createMember = async (data: any) => {
    const response = await axios.post(BASE_URL, data);
    return response.data;
};

export const updateMember = async (id: number, data: any) => {
    const response = await axios.put(`${BASE_URL}${id}/`, data);
    return response.data;
};

export const deleteMember = async (id: number) => {
    const response = await axios.delete(`${BASE_URL}${id}/`);
    return response.status;
};