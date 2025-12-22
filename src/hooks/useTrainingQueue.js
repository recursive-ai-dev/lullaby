import { useState, useRef, useCallback } from 'react';

/**
 * Manages the queue for batch training operations.
 *
 * @param {Object} workerRef - Ref to the worker instance
 * @param {Function} postToWorker - Function to post messages to worker
 * @param {Object} lastTrainRequestIdRef - Ref to track the last train request ID
 * @param {Function} setIsComputing - Function to set computing state
 * @param {Function} addLog - Function to add logs
 * @returns {Object} Training queue state and methods
 */
export function useTrainingQueue({
    workerRef,
    postToWorker,
    lastTrainRequestIdRef,
    setIsComputing,
    addLog
}) {
    const datasetTrainQueueRef = useRef([]);
    const datasetTrainEpochRef = useRef(0);
    const datasetTrainTotalRef = useRef(0);
    const datasetTrainingRef = useRef({ active: false });

    // Public state for UI
    const [datasetTraining, setDatasetTraining] = useState({ active: false, name: '', done: 0, total: 0 });

    /**
     * Starts a batch training session with the given lines.
     * Replaces any existing queue.
     */
    const startBatchTraining = useCallback((lines, { name = 'batch', logMessage } = {}) => {
        if (!lines.length) return;
        if (!workerRef.current) return;

        // Reset and fill queue
        datasetTrainQueueRef.current = [...lines];
        datasetTrainEpochRef.current = 0;
        datasetTrainTotalRef.current = lines.length;

        // Set state
        datasetTrainingRef.current = { active: true };
        setDatasetTraining({ active: true, name, done: 0, total: lines.length });
        setIsComputing(true);

        if (logMessage) addLog('sys', logMessage);

        // Process first item
        const first = datasetTrainQueueRef.current.shift();
        if (!first) {
            datasetTrainingRef.current = { active: false };
            setDatasetTraining({ active: false, name: '', done: 0, total: 0 });
            setIsComputing(false);
            return;
        }

        const reqId = postToWorker('TRAIN', {
            text: first,
            epoch: 0,
            totalEpochs: datasetTrainTotalRef.current,
            isGameplay: false
        });

        if (reqId) {
            lastTrainRequestIdRef.current = reqId;
        }
    }, [workerRef, postToWorker, lastTrainRequestIdRef, setIsComputing, addLog]);

    /**
     * Processes the next item in the queue.
     * Should be called when a TRAIN_COMPLETE message is received.
     */
    const processNextTrainItem = useCallback(() => {
        if (datasetTrainingRef.current?.active) {
            const next = datasetTrainQueueRef.current.shift();
            // Done count is total - remaining
            const done = datasetTrainTotalRef.current - datasetTrainQueueRef.current.length;

            setDatasetTraining((prev) => ({ ...prev, done, total: datasetTrainTotalRef.current }));

            if (next) {
                datasetTrainEpochRef.current = done;
                const reqId = postToWorker('TRAIN', {
                    text: next,
                    epoch: datasetTrainEpochRef.current,
                    totalEpochs: datasetTrainTotalRef.current,
                    isGameplay: false
                });
                lastTrainRequestIdRef.current = reqId;
            } else {
                datasetTrainingRef.current = { active: false };
                setDatasetTraining({ active: false, name: '', done: 0, total: 0 });
                setIsComputing(false);
                addLog('sys', 'MEMORIES SETTLED.');
            }
        } else {
            setIsComputing(false);
        }
    }, [postToWorker, lastTrainRequestIdRef, setIsComputing, addLog]);

    const isTrainingActive = useCallback(() => {
        return datasetTrainingRef.current?.active;
    }, []);

    return {
        datasetTraining,
        startBatchTraining,
        processNextTrainItem,
        isTrainingActive,
        // exposing ref for direct check if needed, though isTrainingActive is preferred
        datasetTrainingRef
    };
}
