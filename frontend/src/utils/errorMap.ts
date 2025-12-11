// Tabela de erros padronizados
// Mapeia mensagens do backend ou chaves internas para mensagens amigáveis

export const ERROR_MAPPING: Record<string, { title: string; message: string; severity: 'error' | 'warning' }> = {
    // Genéricos
    'DEFAULT_ERROR': {
        title: 'Erro inesperado',
        message: 'Ocorreu um erro interno. Nossa equipe já foi notificada. Tente novamente mais tarde.',
        severity: 'error'
    },
    'NETWORK_ERROR': {
        title: 'Sem conexão',
        message: 'Não foi possível conectar ao servidor. Verifique sua internet.',
        severity: 'error'
    },
    'PERMISSION_DENIED': {
        title: 'Acesso Negado',
        message: 'Você não tem permissão para realizar esta ação. Contate seu administrador.',
        severity: 'warning'
    },

    // Usuários
    'USER_ALREADY_EXISTS': {
        title: 'Usuário já cadastrado',
        message: 'Já existe um usuário com este e-mail. Verifique os dados informados.',
        severity: 'warning'
    },
    'USER_NOT_FOUND': {
        title: 'Usuário não encontrado',
        message: 'Não encontramos um usuário com esses dados no sistema.',
        severity: 'warning'
    },
    'USER_SAVE_ERROR': {
        title: 'Falha ao salvar',
        message: 'Não foi possível salvar os dados do usuário. Tente novamente.',
        severity: 'error'
    },
    'USER_DELETE_ERROR': {
        title: 'Falha ao remover',
        message: 'Não foi possível remover este usuário. Ele pode estar vinculado a outros registros.',
        severity: 'error'
    },
    'BRANCH_REQUIRED': {
        title: 'Filial Obrigatória',
        message: 'Ao menos uma filial deve ser selecionada (ou a opção "Todas as filiais").',
        severity: 'warning'
    },

    // Inventário
    'ITEM_SAVE_ERROR': {
        title: 'Falha ao salvar item',
        message: 'Não foi possível cadastrar ou atualizar o item. Verifique os campos obrigatórios.',
        severity: 'error'
    },
    'ASSET_DUPLICATE_CHECK_ERROR': {
        title: 'Erro de Validação',
        message: 'Não foi possível verificar a duplicidade do Ativo Fixo.',
        severity: 'error'
    },
    'ASSET_REQUIRED': {
        title: 'Campo Obrigatório',
        message: 'O número do Ativo Fixo é obrigatório para aprovação.',
        severity: 'warning'
    },
    'STATUS_UPDATE_ERROR': {
        title: 'Falha na Aprovação',
        message: 'Não foi possível atualizar o status. Verifique suas permissões.',
        severity: 'error'
    },
    'TRANSFER_ERROR': {
        title: 'Falha na Transferência',
        message: 'Não foi possível solicitar a transferência. Tente novamente.',
        severity: 'error'
    },
    'WRITEOFF_ERROR': {
        title: 'Falha na Baixa',
        message: 'Não foi possível solicitar a baixa do item. Tente novamente.',
        severity: 'error'
    },

    // Filiais e Categorias
    'BRANCH_SAVE_ERROR': {
        title: 'Falha ao salvar filial',
        message: 'Verifique se o CNPJ é válido ou se você tem permissões.',
        severity: 'error'
    },
    'CATEGORY_SAVE_ERROR': {
        title: 'Falha ao salvar categoria',
        message: 'Não foi possível salvar a categoria. Tente novamente.',
        severity: 'error'
    },

    // Relatórios
    'REPORT_ERROR': {
        title: 'Erro no Relatório',
        message: 'Não foi possível gerar o relatório. Verifique sua conexão.',
        severity: 'error'
    },

    // Sucesso (Apenas template)
    'SUCCESS_GENERIC': {
        title: 'Sucesso',
        message: 'Operação realizada com sucesso!',
        severity: 'warning' // ignored for success calls usually
    }
};

export const getErrorMessage = (error: any, defaultKey = 'DEFAULT_ERROR') => {
    // Tenta extrair mensagem do backend (Axios)
    let backendMsg = '';
    if (error?.response?.data?.detail) {
        backendMsg = error.response.data.detail;
    } else if (error?.message) {
        backendMsg = error.message;
    }

    // Mapeamento direto de mensagens conhecidas do backend
    if (backendMsg === 'E-mail já cadastrado') return ERROR_MAPPING['USER_ALREADY_EXISTS'];
    if (backendMsg.includes('permissão')) return ERROR_MAPPING['PERMISSION_DENIED'];
    if (backendMsg === 'Network Error') return ERROR_MAPPING['NETWORK_ERROR'];

    // Se tiver uma chave padrão mapeada
    if (ERROR_MAPPING[defaultKey]) return ERROR_MAPPING[defaultKey];

    // Fallback genérico
    return ERROR_MAPPING['DEFAULT_ERROR'];
};
