import React, { useState } from 'react';
import { Database, Download, Upload, FileArchive, CheckCircle, ShieldAlert } from 'lucide-react';
import api from '../api';
import { useError } from '../hooks/useError';

const BackupMigration: React.FC = () => {
    const { showSuccess, showError } = useError();
    const [loadingExport, setLoadingExport] = useState(false);
    const [loadingImport, setLoadingImport] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [confirmationInput, setConfirmationInput] = useState('');

    const handleExport = async () => {
        setLoadingExport(true);
        try {
            const response = await api.get('/backup/export', {
                responseType: 'blob',
                timeout: 60000 // 60s timeout for large dumps
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            // Try to extract filename from header
            const contentDisposition = response.headers['content-disposition'];
            let filename = `backup_inventory_${new Date().toISOString().slice(0, 10)}.zip`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) filename = match[1];
            }

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();

            showSuccess('Backup exportado com sucesso!');
        } catch (error) {
            console.error(error);
            showError(error, "BACKUP_EXPORT_ERROR");
        } finally {
            setLoadingExport(false);
        }
    };

    const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setImportFile(e.target.files[0]);
        }
    };

    const handleImportClick = () => {
        if (!importFile) {
            showError(new Error("Selecione um arquivo para importar."), "VALIDATION_ERROR");
            return;
        }
        setConfirmModalOpen(true);
        setConfirmationInput('');
    };

    const executeImport = async () => {
        if (confirmationInput !== 'CONFIRMAR') {
            return;
        }

        if (!importFile) return;

        setConfirmModalOpen(false);
        setLoadingImport(true);

        const formData = new FormData();
        formData.append('file', importFile);

        try {
            const response = await api.post('/backup/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 300000 // 5 min timeout for restore
            });
            showSuccess(response.data.message || 'Banco de dados restaurado com sucesso! Recomendamos recarregar a página.');
            setImportFile(null);
            // Opcional: Recarregar a página após alguns segundos
            setTimeout(() => window.location.reload(), 3000);
        } catch (error) {
            console.error(error);
            showError(error, "BACKUP_IMPORT_ERROR");
        } finally {
            setLoadingImport(false);
        }
    };

    return (
        <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/50 p-6 mt-8 border-l-4 border-l-amber-500">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                <Database className="text-amber-600" size={24} />
                Backup e Migração (Avançado)
            </h2>
            <p className="text-slate-600 mb-6">
                Funcionalidades técnicas para backup completo e restauração do banco de dados.
                <span className="font-bold text-amber-700 block mt-1">
                    Cuidado: A importação substitui TODOS os dados atuais.
                </span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Export Section */}
                <div className="space-y-4 border p-4 rounded-lg bg-slate-50 border-slate-200">
                    <div className="flex items-center gap-2 text-blue-700 font-semibold">
                        <Download size={20} />
                        <h3>Exportar Banco de Dados</h3>
                    </div>
                    <p className="text-sm text-slate-500">
                        Gera um arquivo .zip contendo o dump completo do banco (dados e estrutura) e metadados.
                    </p>
                    <button
                        onClick={handleExport}
                        disabled={loadingExport}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {loadingExport ? (
                            <span>Gerando dump...</span>
                        ) : (
                            <>
                                <FileArchive size={18} /> Baixar Dump Completo
                            </>
                        )}
                    </button>
                </div>

                {/* Import Section */}
                <div className="space-y-4 border p-4 rounded-lg bg-amber-50 border-amber-200">
                    <div className="flex items-center gap-2 text-amber-800 font-semibold">
                        <Upload size={20} />
                        <h3>Importar / Restaurar</h3>
                    </div>
                    <p className="text-sm text-amber-700">
                        Restaura o banco a partir de um backup. Substituirá todos os dados atuais.
                    </p>

                    <div className="space-y-2">
                        <input
                            type="file"
                            accept=".zip"
                            onChange={handleImportFileChange}
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-200 file:text-amber-800 hover:file:bg-amber-300 transition-all"
                        />
                    </div>

                    <button
                        onClick={handleImportClick}
                        disabled={loadingImport || !importFile}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                        {loadingImport ? (
                            <span>Restaurando...</span>
                        ) : (
                            <>
                                <Database size={18} /> Iniciar Restauração
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirmModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border-t-8 border-red-600 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                                <ShieldAlert size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-red-600">ATENÇÃO: PERDA DE DADOS</h3>
                            <p className="text-slate-600 mt-2">
                                Você está prestes a substituir <b>TODO</b> o banco de dados atual pelo conteúdo do backup.
                                <br/><br/>
                                <span className="font-bold">Esta ação é irreversível.</span>
                                Todos os itens, usuários, logs e configurações atuais serão perdidos se não estiverem no backup.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Digite <b>CONFIRMAR</b> para continuar:
                                </label>
                                <input
                                    type="text"
                                    value={confirmationInput}
                                    onChange={(e) => setConfirmationInput(e.target.value)}
                                    placeholder="CONFIRMAR"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none uppercase"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setConfirmModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={executeImport}
                                    disabled={confirmationInput !== 'CONFIRMAR'}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={18} />
                                    Restaurar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BackupMigration;
