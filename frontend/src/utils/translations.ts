
export const translateStatus = (status: string) => {
    if (!status) return '';
    // Handle potential enum prefix from backend logs if any
    const cleanStatus = status.replace('ItemStatus.', '');

    const map: Record<string, string> = {
        'PENDING': 'Pendente',
        'APPROVED': 'Aprovado',
        'REJECTED': 'Rejeitado',
        'TRANSFER_PENDING': 'Transferência Pendente',
        'WRITE_OFF_PENDING': 'Baixa Pendente',
        'WRITTEN_OFF': 'Baixado',
        'MAINTENANCE': 'Em Manutenção',
        'IN_STOCK': 'Em Estoque',
        'IN_TRANSIT': 'Em Trânsito'
    };
    return map[cleanStatus] || cleanStatus;
};

export const translateRole = (role: string | undefined) => {
    if (!role) return '';
    const map: Record<string, string> = {
        'ADMIN': 'Administrador',
        'APPROVER': 'Aprovador',
        'OPERATOR': 'Operador',
        'AUDITOR': 'Auditor'
    };
    return map[role] || role;
};

export const translateLogAction = (action: string) => {
    if (!action) return '';
    let translated = action;

    // Status changes (Legacy support)
    if (translated.includes('Status changed to')) {
        const parts = translated.split('Status changed to ');
        if (parts.length > 1) {
            const status = parts[1].trim();
            return `Status alterado para ${translateStatus(status)}`;
        }
    }

    // Write-off (Legacy support)
    if (translated.includes('Write-off requested')) {
        return translated.replace('Write-off requested. Reason:', 'Solicitação de baixa. Motivo:');
    }

    // Transfer (Legacy support)
    if (translated.includes('Transfer requested to branch')) {
        return translated.replace('Transfer requested to branch', 'Solicitação de transferência para filial');
    }

    // Creation (Legacy support)
    if (translated === 'Item created') return 'Item criado';

    // The backend now sends translated strings, so we can just return the action if no legacy pattern is found.
    return translated;
};
