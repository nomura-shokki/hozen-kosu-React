import React, { useEffect, useState } from 'react';
import { getMembers, deleteMember } from '../api/memberAPI';

const MemberList: React.FC = () => {
    const [members, setMembers] = useState([]);

    useEffect(() => {
        const fetchMembers = async () => {
            const data = await getMembers();
            setMembers(data);
        };

        fetchMembers();
    }, []);

    const handleDelete = async (id: number) => {
        await deleteMember(id);
        setMembers(members.filter((member: any) => member.id !== id));
    };

    return (
        <div>
            <h1>Member List</h1>
            <ul>
                {members.map((member: any) => (
                    <li key={member.id}>
                        {member.name} ({member.shop})
                        <button onClick={() => handleDelete(member.id)}>Delete</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default MemberList;