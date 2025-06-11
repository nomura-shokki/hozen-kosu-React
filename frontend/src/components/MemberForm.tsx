import React, { useState } from 'react';
import { createMember } from '../api/memberAPI';

const MemberForm: React.FC = () => {
    const [formData, setFormData] = useState({
        employee_no: '',
        name: '',
        shop: '',
        authority: false,
        administrator: false,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await createMember(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <input type="text" name="name" placeholder="Name" onChange={handleChange} />
            <select name="shop" onChange={handleChange}>
                <option value="P">P</option>
                <option value="R">R</option>
                {/* Add more options */}
            </select>
            <button type="submit">Create</button>
        </form>
    );
};

export default MemberForm;